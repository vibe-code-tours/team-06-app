import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/staff/pending?restaurant_id=X
 * Returns invites with status 'pending_approval' for the owner's restaurant.
 * Only restaurant_owner and manager can view pending approvals.
 */
export async function GET(request: Request) {
    const supabase = createClient()

    // 1. Authenticate user
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401)

    // 2. Get restaurant_id from query
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get('restaurant_id')

    if (!restaurantId) {
        return err('VALIDATION_ERROR', 'restaurant_id is required', 400)
    }

    // 3. Check user has access to this restaurant
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, restaurant_id')
        .eq('id', user.id)
        .single()

    if (!profile || !['restaurant_owner', 'manager'].includes(profile.role)) {
        return err('FORBIDDEN', 'Forbidden', 403)
    }

    if (profile.restaurant_id !== restaurantId) {
        return err('FORBIDDEN', 'Access denied to this restaurant', 403)
    }

    // 4. Fetch pending approval invites
    const { data, error } = await supabase
        .from('invites')
        .select('id, email, role, full_name, phone, status, created_at, submitted_at')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending_approval')
        .order('submitted_at', { ascending: false })

    if (error) {
        return err('INTERNAL_ERROR', error.message, 500)
    }

    return ok(data || [])
}
