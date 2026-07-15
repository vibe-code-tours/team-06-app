import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { tableSchema } from '@restaurant-qr/shared'
import { createTable } from '@/lib/services/tableService'

const ALLOWED_ROLES = ['restaurant_owner', 'manager', 'super_admin']

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
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('table_number', { ascending: true })

    if (error) {
        return err('INTERNAL_ERROR', error.message, 500)
    }

    return ok(data)
}

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
    const parsed = tableSchema.safeParse(body)

    if (!parsed.success) {
        return err('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten())
    }

    const restaurantId =
        profile.role === 'super_admin' && body.restaurant_id
            ? body.restaurant_id
            : profile.restaurant_id

    if (!restaurantId) {
        return err('VALIDATION_ERROR', 'restaurant_id is required', 400)
    }

    const baseUrl = new URL(request.url).origin
    const result = await createTable(supabase, restaurantId, parsed.data, baseUrl)

    if ('error' in result) {
        return err('CONFLICT', result.error, 422)
    }

    return ok(result, 201)
}
