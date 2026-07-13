import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { updateRestaurant } from '@/lib/services/restaurantService'

export async function PUT(
    request: Request,
    { params }: { params: { restaurantId: string } }
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

    const isOwnerOfThisRestaurant =
        profile?.role === 'restaurant_owner' &&
        profile.restaurant_id === params.restaurantId

    const isSuperAdmin = profile?.role === 'super_admin'

    if (!isOwnerOfThisRestaurant && !isSuperAdmin) {
        return err('FORBIDDEN', 'Forbidden', 403)
    }

    const body = await request.json().catch(() => null)

    if (!body || typeof body !== 'object') {
        return err('VALIDATION_ERROR', 'Invalid request body', 400)
    }

    const result = await updateRestaurant(supabase, params.restaurantId, body)

    if ('error' in result) return err('CONFLICT', result.error, 422)

    return ok(result, 200)
}
