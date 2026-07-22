-- =============================================================================
-- Fix: Anonymous customers cannot read order_items after session closes.
--
-- Root cause:
--   The order_items_select_public_session policy only allows reading items
--   with s.status = 'ACTIVE'. After payment, process_payment() closes the
--   session, so the order_items JOIN on order_sessions returns no rows.
--
--   The /order/success/[orderId] page fetches order_items and calculates
--   subtotal/tax/total from them, so it shows $0.00 everywhere.
--
--   Already fixed for order_sessions and orders in
--   20260721150000_fix_customer_paid_orders_rls.sql — same pattern.
-- =============================================================================

DROP POLICY IF EXISTS order_items_select_public_session ON public.order_items;

CREATE POLICY order_items_select_public_session ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.order_sessions s ON o.table_session_id = s.id
            WHERE o.id = order_items.order_id
            AND s.status IN ('ACTIVE', 'CLOSED')
        )
    );
