import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { updateOrderStatusSchema } from '@restaurant-qr/shared'
import { updateOrderStatus } from '@/lib/services/orderStatusService'

export async function POST(
    request: Request,
    { params }: { params: { orderId: string } }
) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return err('UNAUTHORIZED', 'Unauthorized', 401)
    }

    const body = await request.json().catch(() => null)
    const parsed = updateOrderStatusSchema.safeParse(body)

    if (!parsed.success) {
        return err(
            'VALIDATION_ERROR',
            parsed.error.errors.map((e) => e.message).join(', '),
            400
        )
    }

    const result = await updateOrderStatus(supabase, params.orderId, parsed.data.status)

    if ('error' in result) {
        return err('CONFLICT', result.error, 422)
    }

    return ok(result, 200)
}
