import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
    request: Request,
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
        return err('FORBIDDEN', 'Only owners can cancel invites', 403)
    }

    // Get the invite to verify ownership
    const { data: invite } = await supabase
        .from('invites')
        .select('id, email, restaurant_id')
        .eq('id', id)
        .single()

    if (!invite) {
        return err('NOT_FOUND', 'Invite not found', 404)
    }

    if (invite.restaurant_id !== profile.restaurant_id) {
        return err('FORBIDDEN', 'Access denied', 403)
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

    // Delete profile if it exists
    const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('email', invite.email)
        .eq('restaurant_id', invite.restaurant_id)

    if (profileError) {
        console.error('Failed to delete profile:', profileError)
        // Continue even if delete fails
    }

    // Delete the invite
    const { error } = await supabase
        .from('invites')
        .delete()
        .eq('id', id)

    if (error) {
        return err('INTERNAL_ERROR', error.message, 500)
    }

    return ok({ success: true })
}
