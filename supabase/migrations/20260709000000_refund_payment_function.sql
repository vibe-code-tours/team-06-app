-- =============================================================================
-- Refund Payment Function
-- =============================================================================
-- feature-spec.md §6 requires refund processing with a reason field. The
-- initial schema migration implemented process_payment() but not its
-- inverse. This adds refund_payment() following the same atomic,
-- SECURITY DEFINER pattern as the other business functions.
--
-- Design decision: a refund is a financial reversal only. It does NOT
-- reopen the order (stays COMPLETED) or change table status — the guests
-- have already left. Staff must use release_table() separately if the
-- table itself needs manual intervention.
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
    SET payment_status = 'UNPAID',
        updated_at = now()
    WHERE id = v_payment.order_id;

    RETURN p_payment_id;
END;
$$;

COMMENT ON FUNCTION public.refund_payment(UUID, TEXT) IS
    'Reverses a completed payment: sets payment_status to REFUNDED, appends the reason to notes, '
    'and marks the parent order UNPAID again. Does not reopen order status or table status.';
