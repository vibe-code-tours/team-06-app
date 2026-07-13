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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return err('VALIDATION_ERROR', 'Invalid request body', 400)
    }

    // Allowlist: only these fields can be updated via this route
    const ALLOWED_FIELDS = ['name', 'description', 'phone', 'email', 'address', 'tax_rate', 'is_active', 'logo_url'] as const
    const filtered: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
        if (key in body) {
            filtered[key] = body[key]
        }
    }

    if (Object.keys(filtered).length === 0) {
        return err('VALIDATION_ERROR', 'No valid fields to update', 400)
    }

    const result = await updateRestaurant(supabase, params.restaurantId, filtered)

    if ('error' in result) return err('CONFLICT', result.error, 422)

    return ok(result, 200)
}
