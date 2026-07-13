import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteStaffSchema } from '@restaurant-qr/shared'
import { inviteStaff } from '@/lib/services/staffService'

const ALLOWED_ROLES = ['restaurant_owner', 'super_admin']

export async function POST(request: Request) {
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
    const result = await inviteStaff(adminClient, restaurantId, parsed.data)

    if ('error' in result) {
        return err('INTERNAL_ERROR', result.error, 500)
    }

    return ok(result, 201)
}
