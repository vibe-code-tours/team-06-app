import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = createClient()

    // 1. Authenticate user
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401)

    const { id: targetUserId } = await params

    // 2. Prevent self-deletion
    if (user.id === targetUserId) {
        return err('VALIDATION_ERROR', 'You cannot delete your own account', 400)
    }

    // 3. Get current user's profile to check role and restaurant
    const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, restaurant_id')
        .eq('id', user.id)
        .single()

    if (profileError || !currentUserProfile) {
        return err('INTERNAL_ERROR', 'Failed to verify user permissions', 500)
    }

    // 4. Check user is restaurant_owner
    if (currentUserProfile.role !== 'restaurant_owner') {
        return err('FORBIDDEN', 'Only restaurant owners can delete staff', 403)
    }

    // 5. Get target staff profile
    const { data: targetProfile, error: targetError } = await supabase
        .from('profiles')
        .select('role, restaurant_id, email')
        .eq('id', targetUserId)
        .single()

    if (targetError || !targetProfile) {
        return err('NOT_FOUND', 'Staff member not found', 404)
    }

    // 6. Check target belongs to same restaurant
    if (targetProfile.restaurant_id !== currentUserProfile.restaurant_id) {
        return err('FORBIDDEN', 'Staff member does not belong to your restaurant', 403)
    }

    // 7. Prevent deleting other owners
    if (targetProfile.role === 'restaurant_owner') {
        return err('VALIDATION_ERROR', 'Cannot delete another restaurant owner', 400)
    }

    const adminClient = createAdminClient()

    // 8. Delete profile record
    const { error: deleteProfileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', targetUserId)

    if (deleteProfileError) {
        return err('INTERNAL_ERROR', 'Failed to delete staff profile', 500)
    }

    // 9. Delete auth user
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetUserId)

    if (deleteAuthError) {
        // Profile deleted but auth user deletion failed — log for manual cleanup
        console.error('Failed to delete auth user:', deleteAuthError)
        // Still return success since profile is deleted and user can no longer log in
    }

    return ok({ message: 'Staff member deleted successfully' })
}
