import type { SupabaseClient } from '@supabase/supabase-js';

export interface OrderDetailItem {
    id: string;
    quantity: number;
    unit_price: number;
    special_instructions: string | null;
    menu_item: { name: string };
}

export interface OrderDetail {
    id: string;
    restaurant_id: string;
    status: string;
    payment_status: string;
    created_at: string;
    special_instructions: string | null;
    table: { table_number: number; name: string | null };
    order_items: OrderDetailItem[];
}

export type GetOrderDetailResult = { order: OrderDetail } | { error: string };

// restaurantId is the caller's own profile.restaurant_id, or null for
// super_admin (who may view any restaurant's orders). This scoping check is
// enforced here as defense-in-depth, not just relying on RLS:
// orders_select_public_own_session (see
// supabase/migrations/20250706000000_initial_schema.sql) has no auth.uid()
// check and currently grants SELECT on any restaurant's active-session orders
// to any authenticated caller (tracked separately as a DB-layer bug, issue #60).
export async function getOrderDetail(
    client: SupabaseClient,
    orderId: string,
    restaurantId: string | null
): Promise<GetOrderDetailResult> {
    const { data, error } = await client
        .from('orders')
        .select(`
            id,
            restaurant_id,
            status,
            payment_status,
            created_at,
            special_instructions,
            table:tables(table_number, name),
            order_items(
                id,
                quantity,
                unit_price,
                special_instructions,
                menu_item:menu_items(name)
            )
        `)
        .eq('id', orderId)
        .single();

    if (error || !data) {
        return { error: 'Order not found' };
    }

    if (restaurantId !== null && data.restaurant_id !== restaurantId) {
        return { error: 'Order not found' };
    }

    return { order: data as unknown as OrderDetail };
}
