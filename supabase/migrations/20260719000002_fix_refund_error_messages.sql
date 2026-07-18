-- =============================================================================
-- Fix: refund_payment better error messages
-- =============================================================================
-- Previous: "Cannot refund a payment that is not completed" for all statuses
-- Now: Different messages for REFUNDED vs other non-COMPLETED statuses
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
    v_restaurant_id     UUID;
    v_is_service_role   BOOLEAN;
BEGIN
    v_current_user_id := auth.uid();
    v_is_service_role := current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role';

    IF v_current_user_id IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT * INTO v_payment
    FROM public.payments WHERE id = p_payment_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found: %', p_payment_id;
    END IF;

    v_restaurant_id := v_payment.restaurant_id;

    IF NOT v_is_service_role THEN
        IF NOT public.user_has_role('super_admin', 'restaurant_owner', 'manager', 'cashier')
           OR NOT public.user_belongs_to_restaurant(v_restaurant_id) THEN
            RAISE EXCEPTION 'Forbidden: insufficient permissions to refund this payment';
        END IF;
    END IF;

    -- Better error messages for different statuses
    IF v_payment.payment_status = 'REFUNDED' THEN
        RAISE EXCEPTION 'Payment has already been refunded';
    ELSIF v_payment.payment_status != 'COMPLETED' THEN
        RAISE EXCEPTION 'Cannot refund a payment that is not completed. Current status: %', v_payment.payment_status;
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'A refund reason is required';
    END IF;

    UPDATE public.payments
    SET payment_status = 'REFUNDED',
        notes = COALESCE(notes || E'\n', '') || 'REFUNDED by ' || v_current_user_id::TEXT || ': ' || p_reason,
        updated_at = now()
    WHERE id = p_payment_id;

    UPDATE public.orders
    SET payment_status = 'REFUNDED', updated_at = now()
    WHERE id = v_payment.order_id;

    RETURN p_payment_id;
END;
$$;

COMMENT ON FUNCTION public.refund_payment(UUID, TEXT) IS
    'Reverses a completed payment: sets payment_status to REFUNDED, appends the reason to notes, '
    'and marks the parent order payment_status REFUNDED. Requires authenticated user with '
    'super_admin, restaurant_owner, manager, or cashier role.';
