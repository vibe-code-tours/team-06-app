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

    // Get the invite
    const { data: invite } = await supabase
        .from('invites')
        .select('id, email, role, restaurant_id, status')
        .eq('id', id)
        .single()

    if (!invite) {
        return err('NOT_FOUND', 'Invite not found', 404)
    }

    // Check user has access (owner of this restaurant OR the invitee themselves)
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, restaurant_id')
        .eq('id', user.id)
        .single()

    const isOwner = profile && profile.role === 'restaurant_owner' && profile.restaurant_id === invite.restaurant_id
    const isInvitee = user.email === invite.email

    if (!isOwner && !isInvitee) {
        return err('FORBIDDEN', 'Access denied', 403)
    }

    if (invite.status !== 'pending') {
        return err('VALIDATION_ERROR', 'Can only reject pending invites', 400)
    }

    // Find and delete the auth user that was created when invite was sent
    const adminClient = createAdminClient()
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === invite.email)

    if (existingUser) {
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingUser.id)
        if (deleteError) {
            console.error('Failed to delete auth user:', deleteError)
            // Continue even if delete fails - update invite status
        }
    }

    // Update invite status to rejected
    const { error: updateError } = await supabase
        .from('invites')
        .update({ status: 'rejected' })
        .eq('id', id)

    if (updateError) {
        return err('INTERNAL_ERROR', updateError.message, 500)
    }

    return ok({ success: true, message: 'Invite rejected' })
}
