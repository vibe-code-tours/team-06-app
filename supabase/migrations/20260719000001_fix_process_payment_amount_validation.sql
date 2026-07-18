-- =============================================================================
-- Fix: process_payment server-side amount validation
-- =============================================================================
-- Bug: process_payment accepted any client-sent amount without validating
-- against the order's actual total. A $110 order could be paid with $7.
--
-- Fix: Server calculates subtotal from order_items, tax from restaurant's
-- tax_rate, validates discount, and compares payment amount to expected total.
-- Follows industry patterns from Stripe/Square/PayPal (never trust client amounts).
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
    v_subtotal          DECIMAL(10,2);
    v_tax_rate          DECIMAL(5,4);
    v_calculated_tax    DECIMAL(10,2);
    v_expected_total    DECIMAL(10,2);
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

    -- ====================================================================
    -- Step 1: Lock and verify the order
    -- ====================================================================
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

    -- ====================================================================
    -- Step 2: Authorization check
    -- ====================================================================
    IF NOT v_is_service_role THEN
        IF NOT public.user_has_role('super_admin', 'restaurant_owner', 'manager', 'cashier')
           OR NOT public.user_belongs_to_restaurant(v_restaurant_id) THEN
            RAISE EXCEPTION 'Forbidden: insufficient permissions to process payment';
        END IF;
    END IF;

    -- ====================================================================
    -- Step 3: Order status validation
    -- ====================================================================
    IF v_order.payment_status = 'PAID' THEN
        RAISE EXCEPTION 'Order is already paid';
    END IF;

    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot process payment for a cancelled order';
    END IF;

    IF v_order.status != 'READY' THEN
        RAISE EXCEPTION 'Cannot process payment for an order that is not ready. Current status: %', v_order.status;
    END IF;

    -- ====================================================================
    -- Step 4: Calculate subtotal from order items (server-side, never trust client)
    -- ====================================================================
    SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_subtotal
    FROM public.order_items
    WHERE order_id = p_order_id;

    IF v_subtotal <= 0 THEN
        RAISE EXCEPTION 'Order has no items or subtotal is zero';
    END IF;

    -- ====================================================================
    -- Step 5: Calculate tax from restaurant's tax_rate (server-side)
    -- ====================================================================
    SELECT tax_rate INTO v_tax_rate
    FROM public.restaurants
    WHERE id = v_restaurant_id;

    v_calculated_tax := ROUND(v_subtotal * v_tax_rate, 2);

    -- Validate client-sent tax matches calculated tax (within 1% tolerance for rounding)
    IF ABS(p_tax_amount - v_calculated_tax) > GREATEST(v_calculated_tax * 0.01, 0.01) THEN
        RAISE EXCEPTION 'Tax amount mismatch: expected %, got %', v_calculated_tax, p_tax_amount;
    END IF;

    -- ====================================================================
    -- Step 6: Validate discount
    -- ====================================================================
    IF p_discount_amount < 0 THEN
        RAISE EXCEPTION 'Discount amount cannot be negative';
    END IF;

    IF p_discount_amount > v_subtotal THEN
        RAISE EXCEPTION 'Discount % exceeds order subtotal %', p_discount_amount, v_subtotal;
    END IF;

    -- ====================================================================
    -- Step 7: Calculate expected total and validate payment amount
    -- ====================================================================
    v_expected_total := v_subtotal + v_calculated_tax - p_discount_amount;

    -- Allow free orders (100% discount) but validate amount matches
    -- Use $0.01 tolerance for rounding differences
    IF ABS(p_amount - v_expected_total) > 0.01 THEN
        RAISE EXCEPTION 'Payment amount % does not match order total %. Expected: % (subtotal: % + tax: % - discount: %)',
            p_amount, v_expected_total, v_expected_total, v_subtotal, v_calculated_tax, p_discount_amount;
    END IF;

    -- Block negative total (shouldn't happen after discount validation, but defensive)
    IF v_expected_total < 0 THEN
        RAISE EXCEPTION 'Total amount cannot be negative: %', v_expected_total;
    END IF;

    -- ====================================================================
    -- Step 8: Create payment record
    -- ====================================================================
    INSERT INTO public.payments (
        order_id, restaurant_id, amount, tax_amount, discount_amount,
        total_amount, payment_method, payment_status, transaction_id,
        processed_by, notes
    )
    VALUES (
        p_order_id, v_restaurant_id, p_amount, v_calculated_tax, p_discount_amount,
        v_expected_total, p_payment_method, 'COMPLETED',
        p_transaction_id, v_current_user_id, p_notes
    )
    RETURNING id INTO v_payment_id;

    -- ====================================================================
    -- Step 9: Update order status
    -- ====================================================================
    UPDATE public.orders
    SET payment_status = 'PAID', status = 'COMPLETED', updated_at = now()
    WHERE id = p_order_id;

    -- ====================================================================
    -- Step 10: Close session and release table
    -- ====================================================================
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
    'Atomically processes payment with server-side amount validation. Calculates subtotal from order_items, '
    'tax from restaurant tax_rate, validates discount against subtotal, and compares payment amount to expected total. '
    'Requires authenticated user with super_admin, restaurant_owner, manager, or cashier role. '
    'Only accepts orders in READY status.';
