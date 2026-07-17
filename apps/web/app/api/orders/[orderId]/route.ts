import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { getOrderDetail } from '@/lib/services/orderDetailService'

const ALLOWED_ROLES = [
    'restaurant_owner',
    'manager',
    'kitchen_staff',
    'waiter',
    'cashier',
    'super_admin',
]

export async function GET(
    _request: Request,
    { params }: { params: { orderId: string } }
) {
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

    const restaurantId = profile.role === 'super_admin' ? null : profile.restaurant_id

    const result = await getOrderDetail(supabase, params.orderId, restaurantId)

    if ('error' in result) {
        return err('NOT_FOUND', result.error, 404)
    }

    return ok(result.order, 200)
}
