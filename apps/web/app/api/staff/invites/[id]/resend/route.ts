import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
    _request: Request,
    { params }: { params: { id: string } }
) {
    const supabase = createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401)

    const { id } = params

    // Check user is owner
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, restaurant_id')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'restaurant_owner') {
        return err('FORBIDDEN', 'Only owners can resend invites', 403)
    }

    // Get the invite
    const { data: invite } = await supabase
        .from('invites')
        .select('id, email, role, restaurant_id, status')
        .eq('id', id)
        .single()

    if (!invite) {
        return err('NOT_FOUND', 'Invite not found', 404)
    }

    if (invite.restaurant_id !== profile.restaurant_id) {
        return err('FORBIDDEN', 'Access denied', 403)
    }

    // Allow resend for: pending (expired) OR rejected invites
    if (invite.status !== 'pending' && invite.status !== 'rejected') {
        return err('VALIDATION_ERROR', 'Can only resend pending or rejected invites', 400)
    }

    // Resend the invite email using Supabase
    const adminClient = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Check if user already exists in auth (from previous invite)
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === invite.email)

    if (existingUser) {
        // Delete existing auth user to avoid duplicates
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingUser.id)
        if (deleteError) {
            console.error('Failed to delete existing user:', deleteError)
            return err('INTERNAL_ERROR', 'Failed to reset invite: ' + deleteError.message, 500)
        }
    }

    const { error } = await adminClient.auth.admin.inviteUserByEmail(
        invite.email,
        {
            redirectTo: `${appUrl}/auth/callback`,
            data: {
                role: invite.role,
                restaurant_id: invite.restaurant_id,
            },
        }
    )

    if (error) {
        return err('INTERNAL_ERROR', error.message, 500)
    }

    // Update the invite's status back to pending and refresh timestamp
    const { error: updateError } = await supabase
        .from('invites')
        .update({
            status: 'pending',
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (updateError) {
        console.error('Failed to update invite timestamp:', updateError)
    }

    return ok({ success: true, message: 'Invite resent successfully' })
}
