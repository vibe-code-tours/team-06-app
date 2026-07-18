import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { processPaymentSchema } from '@restaurant-qr/shared'
import { processPayment } from '@/lib/services/paymentService'

const ALLOWED_ROLES = ['cashier', 'manager', 'restaurant_owner', 'super_admin']

export async function POST(request: Request) {
    const supabase = createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return err('UNAUTHORIZED', 'Unauthorized', 401)
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
        return err('FORBIDDEN', 'Forbidden', 403)
    }

    const body = await request.json().catch(() => null)
    const parsed = processPaymentSchema.safeParse(body)

    if (!parsed.success) {
        return err(
            'VALIDATION_ERROR',
            parsed.error.errors.map((e) => e.message).join(', '),
            400
        )
    }

    const result = await processPayment(supabase, parsed.data)

    if ('error' in result) {
        const status = result.error.includes('Forbidden') ? 403 : 422
        const code = status === 403 ? 'FORBIDDEN' : 'CONFLICT'
        return err(code, result.error, status)
    }

    return ok(result, 200)
}
