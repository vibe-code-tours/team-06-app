-- =============================================================================
-- Fix: Restore anonymous customer ordering
-- =============================================================================
-- Issue: Authorization migration (20260718000000) revoked anon execute and
--        added auth check that rejects anonymous customers.
--
-- Fix: Grant execute to anon for create_order_with_session ONLY.
--      Update authorization check to allow anon for this function.
--      Other functions remain staff-only.
--
-- Impact:
--   - Anonymous customers (anon key) → can place orders ✅
--   - Authenticated staff → cannot place orders (correct) ✅
--   - Staff functions → unchanged ✅
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Grant execute to anon for customer ordering
-- ---------------------------------------------------------------------------
-- Only create_order_with_session is granted to anon.
-- Other functions (update_order_status, process_payment, etc.) remain staff-only.
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.create_order_with_session(UUID, UUID, TEXT, TEXT, JSONB) TO anon;


-- ---------------------------------------------------------------------------
-- 2. Update function to allow anonymous customers
-- ---------------------------------------------------------------------------
-- Changes:
--   - Removed auth.uid() IS NULL check that rejected anon
--   - Updated role check to skip for anon (allow anonymous customers)
--   - Authenticated users must still pass super_admin/customer role check
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

    -- Allow: anon (customers), authenticated (super_admin/customer), service_role
    -- No authentication check here — anonymous customers are allowed

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

    -- Authorization: role + restaurant membership (skip for service_role and anon)
    IF NOT v_is_service_role AND v_current_user_id IS NOT NULL THEN
        IF NOT public.user_has_role('super_admin', 'customer')
           OR NOT public.user_belongs_to_restaurant(v_restaurant_id) THEN
            RAISE EXCEPTION 'Forbidden: insufficient permissions to create an order';
        END IF;
    END IF;
    -- If auth.uid() IS NULL — anonymous customer, proceed with order

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
    'Allows anonymous customers (anon) to place orders. Authenticated users must be super_admin or customer.';


-- =============================================================================
-- Verification queries (run manually to confirm fix):
--
-- 1. As anon (customer): should succeed
--    SELECT public.create_order_with_session(
--        '<restaurant-id>',
--        '<table-id>',
--        'Test Customer',
--        NULL,
--        '[{"menu_item_id": "<item-id>", "quantity": 1}]'::JSONB
--    );
--
-- 2. As authenticated staff: should fail with "insufficient permissions"
--    -- (login as waiter/kitchen_staff, then call function)
--
-- 3. As super_admin: should succeed
--    -- (login as super_admin, then call function)
-- =============================================================================
