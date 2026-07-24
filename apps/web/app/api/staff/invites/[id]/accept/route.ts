import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { acceptInviteSchema } from '@restaurant-qr/shared'

/**
 * POST /api/staff/invites/[id]/accept
 * Invited user submits name, phone, and password.
 * Sets invite status to 'pending_approval' — owner must approve before profile is created.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = createClient()
    const { id } = await params

    // 1. Get authenticated user (session from URL hash token)
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
        return err('UNAUTHORIZED', 'You must be signed in to accept an invite', 401)
    }

    // 2. Fetch the invite
    const { data: invite } = await supabase
        .from('invites')
        .select('id, email, restaurant_id, status, created_at')
        .eq('id', id)
        .single()

    if (!invite) {
        return err('NOT_FOUND', 'Invite not found', 404)
    }

    // 3. Verify invite belongs to this user's email
    if (invite.email !== user.email) {
        return err('FORBIDDEN', 'This invite was sent to a different email address', 403)
    }

    // 4. Verify invite is still pending
    if (invite.status !== 'pending') {
        return err('VALIDATION_ERROR', 'This invite is no longer valid', 400)
    }

    // 5. Check expiry (7 days)
    const createdAt = new Date(invite.created_at)
    const now = new Date()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    if (now.getTime() - createdAt.getTime() > sevenDaysMs) {
        return err('VALIDATION_ERROR', 'This invite has expired. Please ask for a new one.', 400)
    }

    // 6. Validate request body
    const body = await request.json().catch(() => null)
    if (!body) {
        return err('VALIDATION_ERROR', 'Invalid request body', 400)
    }

    const parsed = acceptInviteSchema.safeParse(body)
    if (!parsed.success) {
        return err('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten())
    }

    const { full_name, phone, password } = parsed.data

    const adminClient = createAdminClient()

    // 7. Update password via admin client (bypasses RLS)
    const { error: passwordError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { password }
    )

    if (passwordError) {
        console.error('Failed to update password:', passwordError)
        return err('INTERNAL_ERROR', 'Failed to set password. Please try again.', 500)
    }

    // 8. Update invite status to pending_approval with user-submitted details
    const { error: updateError } = await supabase
        .from('invites')
        .update({
            status: 'pending_approval',
            full_name,
            phone,
            submitted_at: new Date().toISOString(),
        })
        .eq('id', id)

    if (updateError) {
        console.error('Failed to update invite status:', updateError)
        return err('INTERNAL_ERROR', 'Failed to submit your acceptance. Please try again.', 500)
    }

    // 9. Sign out the user (they'll need to login after owner approves)
    await supabase.auth.signOut()

    return ok({ success: true, message: 'Your details have been submitted. Waiting for owner approval.' })
}
