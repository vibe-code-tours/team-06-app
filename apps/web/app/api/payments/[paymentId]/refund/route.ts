import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { refundPaymentSchema } from '@restaurant-qr/shared'
import { refundPayment } from '@/lib/services/paymentService'

const ALLOWED_ROLES = ['manager', 'restaurant_owner', 'super_admin']

export async function POST(
    request: Request,
    { params }: { params: { paymentId: string } }
) {
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
    const parsed = refundPaymentSchema.safeParse(body)

    if (!parsed.success) {
        return err('VALIDATION_ERROR', parsed.error.errors.map((e) => e.message).join(', '), 400)
    }

    const result = await refundPayment(supabase, params.paymentId, parsed.data.reason)

    if ('error' in result) {
        return err('CONFLICT', result.error, 422)
    }

    return ok(result, 200)
}
