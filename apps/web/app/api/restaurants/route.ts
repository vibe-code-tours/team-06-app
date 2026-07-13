import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { restaurantSchema } from '@restaurant-qr/shared'
import { createRestaurant } from '@/lib/services/restaurantService'

export async function GET() {
    const supabase = createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401)

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'super_admin') {
        return err('FORBIDDEN', 'Forbidden', 403)
    }

    const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) return err('CONFLICT', error.message, 422)

    return ok(data, 200)
}

export async function POST(request: Request) {
    const supabase = createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401)

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'super_admin') {
        return err('FORBIDDEN', 'Forbidden', 403)
    }

    const body = await request.json().catch(() => null)
    const parsed = restaurantSchema.safeParse(body)

    if (!parsed.success) {
        return err(
            'VALIDATION_ERROR',
            parsed.error.errors.map((e) => e.message).join(', '),
            400
        )
    }

    const result = await createRestaurant(supabase, parsed.data)

    if ('error' in result) return err('CONFLICT', result.error, 422)

    return ok(result, 201)
}
