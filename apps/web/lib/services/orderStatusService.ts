import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderStatus } from '@restaurant-qr/shared';

export type UpdateOrderStatusResult = { status: OrderStatus } | { error: string };

export async function updateOrderStatus(
    client: SupabaseClient,
    orderId: string,
    newStatus: OrderStatus
): Promise<UpdateOrderStatusResult> {
    const { data, error } = await client.rpc('update_order_status', {
        p_order_id: orderId,
        p_new_status: newStatus,
    });

    if (error) {
        return { error: error.message };
    }

    return { status: data as OrderStatus };
}
