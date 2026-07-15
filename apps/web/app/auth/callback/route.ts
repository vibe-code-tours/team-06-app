import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const token = searchParams.get('token')
    const type = searchParams.get('type')
    const code = searchParams.get('code')

    // Handle invite token exchange
    if (token && type === 'invite') {
        const supabase = createClient()
        const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(token)
        if (!error && sessionData.user) {
            // Get user metadata (role, restaurant_id from invite)
            const userMetadata = sessionData.user.user_metadata || {}
            const email = sessionData.user.email || ''
            const role = userMetadata.role || ''
            const restaurantId = userMetadata.restaurant_id || ''

            // Find the pending invite for this email/restaurant
            const { data: invite } = await supabase
                .from('invites')
                .select('id, created_at')
                .eq('email', email)
                .eq('restaurant_id', restaurantId)
                .eq('status', 'pending')
                .single()

            // Check if invite is expired (7 days)
            if (invite) {
                const createdAt = new Date(invite.created_at)
                const now = new Date()
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
                if (now.getTime() - createdAt.getTime() > sevenDaysMs) {
                    // Invite expired — sign out and redirect to login with error
                    await supabase.auth.signOut()
                    return NextResponse.redirect(`${origin}/login?error=invite_expired`)
                }
            }

            const inviteId = invite?.id || ''

            // Redirect to accept-invite page with all details
            const params = new URLSearchParams({
                email,
                role,
                restaurant_id: restaurantId,
                invite_id: inviteId,
            })
            return NextResponse.redirect(`${origin}/auth/accept-invite?${params.toString()}`)
        }
        console.error('Token exchange error:', error)
    }

    // Handle authorization code (PKCE flow)
    if (code) {
        const supabase = createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            // Check if user needs to complete profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
                .single()

            if (profile && !profile.full_name) {
                // New user - needs to complete profile
                return NextResponse.redirect(`${origin}/auth/accept-invite`)
            }
            // Existing user - go to dashboard
            return NextResponse.redirect(`${origin}/`)
        }
        console.error('Code exchange error:', error)
    }

    return NextResponse.redirect(`${origin}/login`)
}
