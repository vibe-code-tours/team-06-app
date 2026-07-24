import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createAnonClient } from '@supabase/supabase-js'

/**
 * POST /api/staff/invites/[id]/approve
 * Owner approves a pending invite. Creates the user's profile via admin client
 * (bypasses RLS) and updates invite status to 'accepted'.
 */
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = createClient()
    const { id } = await params

    // 1. Authenticate current user
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401)

    // 2. Get their profile to check role and restaurant
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, restaurant_id')
        .eq('id', user.id)
        .single()

    if (!profile) {
        return err('UNAUTHORIZED', 'Profile not found', 401)
    }

    // 3. Only restaurant_owner can approve
    if (profile.role !== 'restaurant_owner') {
        return err('FORBIDDEN', 'Only restaurant owners can approve staff invites', 403)
    }

    // 4. Fetch the invite
    const { data: invite } = await supabase
        .from('invites')
        .select('id, email, role, restaurant_id, status, full_name, phone')
        .eq('id', id)
        .single()

    if (!invite) {
        return err('NOT_FOUND', 'Invite not found', 404)
    }

    // 5. Verify invite belongs to owner's restaurant
    if (invite.restaurant_id !== profile.restaurant_id) {
        return err('FORBIDDEN', 'This invite does not belong to your restaurant', 403)
    }

    // 6. Verify invite is in pending_approval state
    if (invite.status !== 'pending_approval') {
        return err('VALIDATION_ERROR', 'This invite is not awaiting approval', 400)
    }

    const adminClient = createAdminClient()

    // 7. Find the auth user by email to get their ID
    const { data: { users } } = await adminClient.auth.admin.listUsers()
    const invitedUser = users?.find(u => u.email === invite.email)

    if (!invitedUser) {
        return err('NOT_FOUND', 'The invited user account no longer exists', 404)
    }

    // 8. Create or update profile via admin client (bypasses RLS)
    //    Use upsert to handle cases where orphan profile exists from old trigger
    const { error: insertError } = await adminClient
        .from('profiles')
        .upsert({
            id: invitedUser.id,
            email: invite.email,
            full_name: invite.full_name || '',
            phone: invite.phone || '',
            role: invite.role,
            restaurant_id: invite.restaurant_id,
            is_active: true,
        }, { onConflict: 'id' })

    if (insertError) {
        console.error('Failed to create profile:', insertError)
        return err('INTERNAL_ERROR', 'Failed to create staff profile', 500)
    }

    // 9. Update invite status to accepted
    const { error: updateError } = await supabase
        .from('invites')
        .update({ status: 'accepted' })
        .eq('id', id)

    if (updateError) {
        console.error('Failed to update invite status:', updateError)
        // Profile was created but invite status update failed — log for manual cleanup
        // This is non-critical; the profile exists and user can login
    }

    // 10. Send magic link email so user can login easily
    //    Use a fresh anon client (no user session) to send the OTP
    const anonClient = createAnonClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error: otpError } = await anonClient.auth.signInWithOtp({
        email: invite.email,
        options: {
            shouldCreateUser: false,
        },
    })

    if (otpError) {
        console.error('Failed to send login email:', otpError)
        // Non-critical — user can still login with password they set
    }

    return ok({ success: true, message: 'Staff member approved successfully' })
}
