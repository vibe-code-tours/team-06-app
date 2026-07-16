import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    // Filter out profiles where auth user no longer exists
    const adminClient = createAdminClient()
    const { data: authUsers } = await adminClient.auth.admin.listUsers()

    const validProfiles = (data ?? []).filter(profile =>
        authUsers?.users?.some(authUser => authUser.email === profile.email)
    )

    return ok(validProfiles)
}
