import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { rateOrderSchema } from '@restaurant-qr/shared/validators'
import { createClient } from '@/lib/supabase/server'

export async function GET(
    _request: Request,
    { params }: { params: { orderId: string } }
) {
    const supabase = createClient()

    const { data: rating, error } = await supabase
        .from('order_ratings')
        .select('*')
        .eq('order_id', params.orderId)
        .maybeSingle()

    if (error) {
        return err('INTERNAL_ERROR', 'Failed to fetch rating', 500)
    }

    return ok(rating)
}

export async function POST(
    request: Request,
    { params }: { params: { orderId: string } }
) {
    const supabase = createClient()

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return err('VALIDATION_ERROR', 'Invalid JSON body', 400)
    }

    const parsed = rateOrderSchema.safeParse({ ...body, order_id: params.orderId })
    if (!parsed.success) {
        return err('VALIDATION_ERROR', parsed.error.issues[0].message, 400)
    }

    const { order_id, overall_rating, food_quality_rating, service_rating, feedback_text } = parsed.data

    // Verify order exists and is completed
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, status, restaurant_id')
        .eq('id', order_id)
        .single()

    if (orderError || !order) {
        return err('NOT_FOUND', 'Order not found', 404)
    }

    if (order.status !== 'COMPLETED') {
        return err('VALIDATION_ERROR', 'Can only rate completed orders', 400)
    }

    // Check for existing rating
    const { data: existing } = await supabase
        .from('order_ratings')
        .select('id')
        .eq('order_id', order_id)
        .maybeSingle()

    if (existing) {
        return err('CONFLICT', 'You have already rated this order', 409)
    }

    // Insert rating
    const { data: rating, error: insertError } = await supabase
        .from('order_ratings')
        .insert({
            order_id,
            restaurant_id: order.restaurant_id,
            overall_rating,
            food_quality_rating: food_quality_rating ?? null,
            service_rating: service_rating ?? null,
            feedback_text: feedback_text ?? null,
        })
        .select()
        .single()

    if (insertError) {
        return err('INTERNAL_ERROR', 'Failed to save rating', 500)
    }

    return ok(rating, 201)
}
