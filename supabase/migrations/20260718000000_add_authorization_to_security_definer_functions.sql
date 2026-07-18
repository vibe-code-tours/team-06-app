-- =============================================================================
-- Fix Issue #36: Add authorization checks to SECURITY DEFINER functions
-- =============================================================================
-- These functions bypass RLS by design but had NO caller authorization checks,
-- making them callable by anyone (including anon) via PostgREST RPC.
--
-- Two-part fix:
--   1. Add role + restaurant-membership checks inside each function
--   2. Revoke PUBLIC/ANON execute, grant only to authenticated
--
-- service_role (server-side trusted key) bypasses authorization checks since
-- auth.uid() returns NULL for service_role JWTs. This is safe because
-- service_role is a server-side secret never exposed to the browser.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. create_order_with_session  — allowed: super_admin, customer
-- ---------------------------------------------------------------------------
-- Takes p_restaurant_id from client but validates it matches the table's
-- actual restaurant_id via the FOR UPDATE lock. Authorization check uses
-- that validated restaurant_id, never the client-provided one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_with_session(
    p_restaurant_id     UUID,
    p_table_id          UUID,
    p_customer_name     TEXT DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL,
    p_items             JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id    UUID;
    v_order_id      UUID;
    v_item          JSONB;
    v_menu_item     RECORD;
    v_new_order     RECORD;
    v_current_user_id UUID;
    v_restaurant_id UUID;
    v_is_service_role BOOLEAN;
BEGIN
    v_current_user_id := auth.uid();
    v_is_service_role := current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role';

    IF v_current_user_id IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 1: Lock the table row to prevent concurrent session creation
    -- -----------------------------------------------------------------------
    SELECT restaurant_id INTO v_restaurant_id
    FROM public.tables
    WHERE id = p_table_id
    AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Table not found or does not belong to this restaurant';
    END IF;

    -- Authorization: role + restaurant membership (skip for service_role)
    IF NOT v_is_service_role THEN
        IF NOT public.user_has_role('super_admin', 'customer')
           OR NOT public.user_belongs_to_restaurant(v_restaurant_id) THEN
            RAISE EXCEPTION 'Forbidden: insufficient permissions to create an order';
        END IF;
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Check for existing active session
    -- -----------------------------------------------------------------------
    SELECT id INTO v_session_id
    FROM public.order_sessions
    WHERE table_id = p_table_id
    AND status = 'ACTIVE'
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'An active session already exists for this table. Please pay the current bill before placing a new order.';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 3: Create a new session
    -- -----------------------------------------------------------------------
    INSERT INTO public.order_sessions (restaurant_id, table_id, status)
    VALUES (v_restaurant_id, p_table_id, 'ACTIVE')
    RETURNING id INTO v_session_id;

    -- -----------------------------------------------------------------------
    -- Step 4: Create the order
    -- -----------------------------------------------------------------------
    INSERT INTO public.orders (
        restaurant_id,
        table_session_id,
        table_id,
        customer_name,
        status,
        payment_status,
        special_instructions
    )
    VALUES (
        v_restaurant_id,
        v_session_id,
        p_table_id,
        p_customer_name,
        'PENDING',
        'UNPAID',
        p_special_instructions
    )
    RETURNING * INTO v_new_order;

    v_order_id := v_new_order.id;

    -- -----------------------------------------------------------------------
    -- Step 5: Insert order items
    -- -----------------------------------------------------------------------
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT id, price, is_available, name INTO v_menu_item
        FROM public.menu_items
        WHERE id = (v_item->>'menu_item_id')::UUID
        AND restaurant_id = v_restaurant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Menu item not found: %', v_item->>'menu_item_id';
        END IF;

        IF NOT v_menu_item.is_available THEN
            RAISE EXCEPTION 'Menu item is not available: %', v_menu_item.name;
        END IF;

        IF (v_item->>'quantity')::INTEGER <= 0 THEN
            RAISE EXCEPTION 'Quantity must be at least 1 for item: %', v_menu_item.name;
        END IF;

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            quantity,
            unit_price,
            special_instructions
        )
        VALUES (
            v_order_id,
            (v_item->>'menu_item_id')::UUID,
            (v_item->>'quantity')::INTEGER,
            v_menu_item.price,
            v_item->>'special_instructions'
        );
    END LOOP;

    -- -----------------------------------------------------------------------
    -- Step 6: Update table status to OCCUPIED
    -- -----------------------------------------------------------------------
    UPDATE public.tables
    SET status = 'OCCUPIED', updated_at = now()
    WHERE id = p_table_id;

    RETURN v_order_id;
END;
$$;

COMMENT ON FUNCTION public.create_order_with_session(UUID, UUID, TEXT, TEXT, JSONB) IS
    'Atomically creates an order with session. Enforces one active session per table. '
    'Items is a JSONB array of {menu_item_id, quantity, special_instructions}. '
    'Requires authenticated user with super_admin or customer role in the restaurant.';


-- ---------------------------------------------------------------------------
-- 2. update_order_status  — allowed: super_admin, restaurant_owner, manager, kitchen_staff
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_order_status(
    p_order_id      UUID,
    p_new_status    public.order_status
)
RETURNS public.order_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status    public.order_status;
    v_valid_transition  BOOLEAN := false;
    v_restaurant_id     UUID;
    v_current_user_id   UUID;
    v_is_service_role   BOOLEAN;
BEGIN
    v_current_user_id := auth.uid();
    v_is_service_role := current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role';

    IF v_current_user_id IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT status, restaurant_id INTO v_current_status, v_restaurant_id
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;

    IF NOT v_is_service_role THEN
        IF NOT public.user_has_role('super_admin', 'restaurant_owner', 'manager', 'kitchen_staff')
           OR NOT public.user_belongs_to_restaurant(v_restaurant_id) THEN
            RAISE EXCEPTION 'Forbidden: insufficient permissions for this order';
        END IF;
    END IF;

    -- Validate transition
    IF p_new_status = 'CANCELLED' THEN
        IF v_current_status = 'COMPLETED' THEN
            RAISE EXCEPTION 'Cannot cancel a completed order';
        END IF;
        v_valid_transition := true;
    ELSIF v_current_status = 'PENDING' AND p_new_status = 'ACCEPTED' THEN
        v_valid_transition := true;
    ELSIF v_current_status = 'ACCEPTED' AND p_new_status = 'PREPARING' THEN
        v_valid_transition := true;
    ELSIF v_current_status = 'PREPARING' AND p_new_status = 'READY' THEN
        v_valid_transition := true;
    ELSIF v_current_status = 'READY' AND p_new_status = 'COMPLETED' THEN
        v_valid_transition := true;
    END IF;

    IF NOT v_valid_transition THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %', v_current_status, p_new_status;
    END IF;

    UPDATE public.orders
    SET status = p_new_status, updated_at = now()
    WHERE id = p_order_id;

    RETURN p_new_status;
END;
$$;

COMMENT ON FUNCTION public.update_order_status(UUID, public.order_status) IS
    'Updates order status with strict transition validation and authorization. '
    'Valid transitions: PENDING->ACCEPTED->PREPARING->READY->COMPLETED, or any->CANCELLED (except COMPLETED). '
    'Requires authenticated user with super_admin, restaurant_owner, manager, or kitchen_staff role.';


-- ---------------------------------------------------------------------------
-- 3. process_payment  — allowed: super_admin, restaurant_owner, manager, cashier
-- ---------------------------------------------------------------------------
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
    'restaurant_owner, manager, or cashier role.';


-- ---------------------------------------------------------------------------
-- 4. release_table  — allowed: super_admin, restaurant_owner, manager, waiter
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_table(
    p_table_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session           RECORD;
    v_current_user_id   UUID;
    v_restaurant_id     UUID;
    v_is_service_role   BOOLEAN;
BEGIN
    v_current_user_id := auth.uid();
    v_is_service_role := current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role';

    IF v_current_user_id IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT id, restaurant_id INTO v_session
    FROM public.order_sessions
    WHERE table_id = p_table_id AND status = 'ACTIVE'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active session found for this table';
    END IF;

    v_restaurant_id := v_session.restaurant_id;

    IF NOT v_is_service_role THEN
        IF NOT public.user_has_role('super_admin', 'restaurant_owner', 'manager', 'waiter')
           OR NOT public.user_belongs_to_restaurant(v_restaurant_id) THEN
            RAISE EXCEPTION 'Forbidden: insufficient permissions to release this table';
        END IF;
    END IF;

    UPDATE public.orders
    SET status = 'CANCELLED', updated_at = now()
    WHERE table_session_id = v_session.id
    AND payment_status = 'UNPAID' AND status != 'CANCELLED';

    UPDATE public.order_sessions
    SET status = 'RELEASED', closed_at = now()
    WHERE id = v_session.id;

    UPDATE public.tables
    SET status = 'AVAILABLE', updated_at = now()
    WHERE id = p_table_id;
END;
$$;

COMMENT ON FUNCTION public.release_table(UUID) IS
    'Manually releases a table: cancels unpaid orders, closes session as RELEASED, '
    'and sets table status to AVAILABLE. Requires authenticated user with super_admin, '
    'restaurant_owner, manager, or waiter role.';


-- ---------------------------------------------------------------------------
-- 5. refund_payment  — allowed: super_admin, restaurant_owner, manager, cashier
-- ---------------------------------------------------------------------------
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

    IF v_payment.payment_status != 'COMPLETED' THEN
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


-- ---------------------------------------------------------------------------
-- 6. Revoke PUBLIC execution, grant only to authenticated + service_role
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_order_with_session(UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_order_status(UUID, public.order_status) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_payment(UUID, DECIMAL, DECIMAL, DECIMAL, public.payment_method, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_table(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refund_payment(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_order_with_session(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, public.order_status) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_payment(UUID, DECIMAL, DECIMAL, DECIMAL, public.payment_method, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_table(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refund_payment(UUID, TEXT) TO authenticated, service_role;
