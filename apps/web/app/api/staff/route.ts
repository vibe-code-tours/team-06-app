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

    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('restaurant_id', restaurantId)
        .neq('role', 'customer')
        .order('created_at', { ascending: false })

    if (error) {
        return err('INTERNAL_ERROR', error.message, 500)
    }

    return ok(data)
}
