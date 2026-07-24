import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteStaffSchema } from '@restaurant-qr/shared'
import { inviteStaff } from '@/lib/services/staffService'

const ALLOWED_ROLES = ['restaurant_owner', 'super_admin']

export async function POST(request: Request) {
    try {
        const supabase = createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401)

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, restaurant_id')
            .eq('id', user.id)
            .single()

        if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
            return err('FORBIDDEN', 'Forbidden', 403)
        }

        const body = await request.json().catch(() => null)
        const parsed = inviteStaffSchema.safeParse(body)

        if (!parsed.success) {
            return err('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten())
        }

        // Determine restaurant_id based on role
        const restaurantId =
            profile.role === 'super_admin'
                ? body.restaurant_id  // super_admin must pass restaurant_id explicitly
                : profile.restaurant_id  // owner uses their own restaurant_id

        if (!restaurantId) {
            return err('VALIDATION_ERROR', 'restaurant_id is required', 400)
        }

        const adminClient = createAdminClient()

        // Check for duplicate pending invite in invites table
        try {
            const { data: existingInvite } = await supabase
                .from('invites')
                .select('id, email')
                .eq('email', parsed.data.email)
                .eq('restaurant_id', restaurantId)
                .eq('status', 'pending')
                .single()

            if (existingInvite) {
                return err('VALIDATION_ERROR', 'This email has already been invited', 400)
            }
        } catch (checkErr) {
            // No existing invite found (0 rows) — this is normal for new invites
        }

        const result = await inviteStaff(adminClient, restaurantId, parsed.data)

        if ('error' in result) {
            // Return 400 for validation errors (duplicate email, etc.)
            // Return 500 for actual server errors
            const status = result.error.includes('already registered') ||
                           result.error.includes('already invited')
                ? 400
                : 500
            console.error('inviteStaff failed:', result.error)
            return err('VALIDATION_ERROR', result.error, status)
        }

        // Save invite to invites table
        const { error: insertError } = await supabase
            .from('invites')
            .insert({
                email: parsed.data.email,
                role: parsed.data.role,
                restaurant_id: restaurantId,
                invited_by: user.id,
                status: 'pending'
            })

        if (insertError) {
            console.error('Failed to save invite to database:', insertError)
            // Don't fail the request - invite was already sent via email
        }

        return ok(result, 201)
    } catch (caughtErr) {
        const message = caughtErr instanceof Error ? caughtErr.message : 'An unexpected error occurred'
        console.error('Unhandled error in POST /api/staff/invite:', caughtErr)
        return err('INTERNAL_ERROR', message, 500)
    }
}
