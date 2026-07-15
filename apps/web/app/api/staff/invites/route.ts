import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const supabase = createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401)

    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get('restaurant_id')

    if (!restaurantId) {
        return err('VALIDATION_ERROR', 'restaurant_id is required', 400)
    }

    // Check user has access to this restaurant
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

    // Fetch pending and rejected invites (can resend to both)
    const { data, error } = await supabase
        .from('invites')
        .select('id, email, role, status, created_at')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'rejected'])
        .order('created_at', { ascending: false })

    if (error) {
        return err('INTERNAL_ERROR', error.message, 500)
    }

    return ok(data)
}
