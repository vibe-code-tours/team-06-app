import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'

/**
 * Public order lookup — no authentication required.
 * Used by the order confirmation page to display order details.
 * Only returns non-sensitive fields.
 */
export async function GET(
    _request: Request,
    { params }: { params: { orderId: string } }
) {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(params.orderId)) {
        return err('VALIDATION_ERROR', 'Invalid order ID format', 400)
    }

    const supabase = createClient()

    const { data: order, error } = await supabase
        .from('orders')
        .select(`
            id,
            status,
            payment_status,
            created_at,
            restaurant_id,
            table:tables(id, table_number, name),
            restaurant:restaurants(name, tax_rate),
            order_items(
                id,
                quantity,
                unit_price,
                menu_item:menu_items(name)
            )
        `)
        .eq('id', params.orderId)
        .single()

    if (error || !order) {
        return err('NOT_FOUND', 'Order not found', 404)
    }

    return ok(order)
}
