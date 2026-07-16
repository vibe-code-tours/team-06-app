-- =============================================================================
-- Migration: refund_payment() marks the order REFUNDED instead of UNPAID
-- =============================================================================
-- Follows 20260717000000_add_refunded_order_payment_status.sql, which added
-- the REFUNDED value to order_payment_status. A refunded order is now
-- distinguishable from one that was never paid, so it no longer reappears in
-- cashier/staff "awaiting payment" views as if it needed a first payment.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refund_payment(
    p_payment_id    UUID,
    p_reason        TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment           RECORD;
    v_current_user_id   UUID;
BEGIN
    v_current_user_id := auth.uid();

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found: %', p_payment_id;
    END IF;

    IF v_payment.payment_status != 'COMPLETED' THEN
        RAISE EXCEPTION 'Cannot refund a payment that is not completed. Current status: %', v_payment.payment_status;
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'A refund reason is required';
    END IF;

    UPDATE public.payments
    SET payment_status = 'REFUNDED',
        notes = COALESCE(notes || E'\n', '') || 'REFUNDED by ' || COALESCE(v_current_user_id::TEXT, 'system') || ': ' || p_reason,
        updated_at = now()
    WHERE id = p_payment_id;

    UPDATE public.orders
    SET payment_status = 'REFUNDED',
        updated_at = now()
    WHERE id = v_payment.order_id;

    RETURN p_payment_id;
END;
$$;

COMMENT ON FUNCTION public.refund_payment(UUID, TEXT) IS
    'Reverses a completed payment: sets payment_status to REFUNDED, appends the reason to notes, '
    'and marks the parent order payment_status REFUNDED. Does not reopen order status or table status.';
