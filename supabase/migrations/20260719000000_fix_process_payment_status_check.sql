-- =============================================================================
-- Fix: process_payment must only accept READY orders
-- =============================================================================
-- Bug found during Issue #36 testing: process_payment only blocks PAID and
-- CANCELLED orders but allows payment for PENDING/ACCEPTED/PREPARING orders.
-- This lets cashiers pay for orders that kitchen hasn't prepared yet.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_payment(
    p_order_id          UUID,
    p_amount            DECIMAL(10,2),
    p_tax_amount        DECIMAL(10,2) DEFAULT 0,
    p_discount_amount   DECIMAL(10,2) DEFAULT 0,
    p_payment_method    public.payment_method DEFAULT 'CASH',
    p_transaction_id    TEXT DEFAULT NULL,
    p_notes             TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order             RECORD;
    v_session           RECORD;
    v_total_amount      DECIMAL(10,2);
    v_payment_id        UUID;
    v_current_user_id   UUID;
    v_restaurant_id     UUID;
    v_is_service_role   BOOLEAN;
BEGIN
    v_current_user_id := auth.uid();
    v_is_service_role := current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role';

    IF v_current_user_id IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT o.*, t.table_id, t.id AS session_id, t.restaurant_id AS session_restaurant_id
    INTO v_order
    FROM public.orders o
    LEFT JOIN public.order_sessions t ON o.table_session_id = t.id
    WHERE o.id = p_order_id
    FOR UPDATE OF o;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;

    v_restaurant_id := v_order.restaurant_id;

    IF NOT v_is_service_role THEN
        IF NOT public.user_has_role('super_admin', 'restaurant_owner', 'manager', 'cashier')
           OR NOT public.user_belongs_to_restaurant(v_restaurant_id) THEN
            RAISE EXCEPTION 'Forbidden: insufficient permissions to process payment';
        END IF;
    END IF;

    IF v_order.payment_status = 'PAID' THEN
        RAISE EXCEPTION 'Order is already paid';
    END IF;

    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot process payment for a cancelled order';
    END IF;

    -- Only allow payment for orders that are READY (kitchen has prepared them)
    IF v_order.status != 'READY' THEN
        RAISE EXCEPTION 'Cannot process payment for an order that is not ready. Current status: %', v_order.status;
    END IF;

    v_total_amount := p_amount + p_tax_amount - p_discount_amount;

    IF v_total_amount < 0 THEN
        RAISE EXCEPTION 'Total amount cannot be negative: %', v_total_amount;
    END IF;

    INSERT INTO public.payments (
        order_id, restaurant_id, amount, tax_amount, discount_amount,
        total_amount, payment_method, payment_status, transaction_id,
        processed_by, notes
    )
    VALUES (
        p_order_id, v_order.restaurant_id, p_amount, p_tax_amount,
        p_discount_amount, v_total_amount, p_payment_method, 'COMPLETED',
        p_transaction_id, v_current_user_id, p_notes
    )
    RETURNING id INTO v_payment_id;

    UPDATE public.orders
    SET payment_status = 'PAID', status = 'COMPLETED', updated_at = now()
    WHERE id = p_order_id;

    IF v_order.session_id IS NOT NULL THEN
        UPDATE public.order_sessions
        SET status = 'CLOSED', closed_at = now()
        WHERE id = v_order.session_id AND status = 'ACTIVE';
    END IF;

    IF v_order.table_id IS NOT NULL THEN
        UPDATE public.tables
        SET status = 'AVAILABLE', updated_at = now()
        WHERE id = v_order.table_id;
    END IF;

    RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION public.process_payment(UUID, DECIMAL, DECIMAL, DECIMAL, public.payment_method, TEXT, TEXT) IS
    'Atomically processes payment: creates payment record, marks order as PAID/COMPLETED, '
    'closes session, and releases table. Requires authenticated user with super_admin, '
    'restaurant_owner, manager, or cashier role. Only accepts orders in READY status.';
