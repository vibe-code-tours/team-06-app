-- =============================================================================
-- Anonymous Customer Ordering Fix — Verification Script
-- =============================================================================
-- Tests that anon users can call create_order_with_session, and that
-- the function allows anonymous customers to place orders.
--
-- Usage:
--   1. Run this script in Supabase SQL Editor
--   2. Check the results
--   3. Run cleanup script to remove test data
-- =============================================================================


-- ===========================================================================
-- STEP 1: Create test data
-- ===========================================================================
-- Note: SET role doesn't work in Supabase SQL Editor, so we insert directly.
-- The default user (postgres) has permission to insert.
-- ===========================================================================

-- Test Restaurant
INSERT INTO public.restaurants (id, name, is_active, tax_rate)
VALUES ('d0000000-0000-4000-8000-000000000001', 'Test Restaurant (Anon Ordering)', true, 0.08)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- Test Table
INSERT INTO public.tables (id, restaurant_id, table_number, qr_code, is_active, status)
VALUES ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 10, 'QR-TEST-ANON-1', true, 'AVAILABLE')
ON CONFLICT (id) DO UPDATE SET status = 'AVAILABLE', is_active = true;

-- Test Category
INSERT INTO public.categories (id, restaurant_id, name, sort_order)
VALUES ('d2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Test Category', 0)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Test Menu Item
INSERT INTO public.menu_items (id, restaurant_id, category_id, name, price, is_available, sort_order)
VALUES ('d3000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Test Burger', 12.50, true, 0)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_available = true;


-- ===========================================================================
-- STEP 2: Test permissions
-- ===========================================================================

SELECT * FROM (
    -- Test 1: Anon has EXECUTE permission on create_order_with_session
    SELECT '1' AS test_num,
        'Anon has EXECUTE on create_order_with_session' AS test_name,
        'GRANT exists' AS expected,
        CASE WHEN has_function_privilege('anon', 'public.create_order_with_session(UUID, UUID, TEXT, TEXT, JSONB)', 'EXECUTE') THEN 'GRANT exists' ELSE 'NO GRANT' END AS actual,
        CASE WHEN has_function_privilege('anon', 'public.create_order_with_session(UUID, UUID, TEXT, TEXT, JSONB)', 'EXECUTE') THEN '✅ PASS' ELSE '❌ FAIL' END AS status

    UNION ALL

    -- Test 2: Anon does NOT have EXECUTE on update_order_status (staff only)
    SELECT '2',
        'Anon has NO EXECUTE on update_order_status (staff only)',
        'NO GRANT',
        CASE WHEN has_function_privilege('anon', 'public.update_order_status(UUID, order_status)', 'EXECUTE') THEN 'GRANT exists' ELSE 'NO GRANT' END,
        CASE WHEN NOT has_function_privilege('anon', 'public.update_order_status(UUID, order_status)', 'EXECUTE') THEN '✅ PASS' ELSE '❌ FAIL' END

    UNION ALL

    -- Test 3: Anon does NOT have EXECUTE on process_payment (staff only)
    SELECT '3',
        'Anon has NO EXECUTE on process_payment (staff only)',
        'NO GRANT',
        CASE WHEN has_function_privilege('anon', 'public.process_payment(UUID, DECIMAL, DECIMAL, DECIMAL, payment_method, TEXT, TEXT)', 'EXECUTE') THEN 'GRANT exists' ELSE 'NO GRANT' END,
        CASE WHEN NOT has_function_privilege('anon', 'public.process_payment(UUID, DECIMAL, DECIMAL, DECIMAL, payment_method, TEXT, TEXT)', 'EXECUTE') THEN '✅ PASS' ELSE '❌ FAIL' END

    UNION ALL

    -- Test 4: Function allows anon (no auth.uid() rejection in IF statement)
    SELECT '4',
        'Function allows anon (no auth.uid() rejection)',
        'No old rejection pattern',
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            WHERE p.proname = 'create_order_with_session'
            AND (p.prosrc LIKE '%IF v_current_user_id IS NULL%RAISE EXCEPTION%'
                 OR p.prosrc LIKE '%IF auth.uid() IS NULL%RAISE EXCEPTION%')
        ) THEN 'Has old rejection' ELSE 'No old rejection' END,
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM pg_proc p
            WHERE p.proname = 'create_order_with_session'
            AND (p.prosrc LIKE '%IF v_current_user_id IS NULL%RAISE EXCEPTION%'
                 OR p.prosrc LIKE '%IF auth.uid() IS NULL%RAISE EXCEPTION%')
        ) THEN '✅ PASS' ELSE '❌ FAIL' END
) AS permission_tests
ORDER BY test_num;


-- ===========================================================================
-- STEP 3: Test function call (run separately if needed)
-- ===========================================================================
-- If the above tests pass, run this to test the actual function:
--
-- SELECT public.create_order_with_session(
--     'd0000000-0000-4000-8000-000000000001'::UUID,
--     'd1000000-0000-4000-8000-000000000001'::UUID,
--     'Anon Test Customer',
--     NULL,
--     '[{"menu_item_id": "d3000000-0000-4000-8000-000000000001", "quantity": 1}]'::JSONB
-- );
--
-- Expected: Returns a UUID (order_id)
-- ===========================================================================


-- ===========================================================================
-- STEP 4: Verify data was created (run after Step 3)
-- ===========================================================================
-- Run this after calling the function to verify data:
--
-- SELECT
--     o.id, o.status, o.customer_name,
--     t.status as table_status,
--     os.status as session_status,
--     (SELECT COUNT(*) FROM public.order_items WHERE order_id = o.id) as item_count
-- FROM public.orders o
-- JOIN public.order_sessions os ON os.table_id = o.table_id
-- JOIN public.tables t ON t.id = o.table_id
-- WHERE o.restaurant_id = 'd0000000-0000-4000-8000-000000000001'
-- ORDER BY o.created_at DESC
-- LIMIT 1;
--
-- Expected: status=PENDING, table_status=OCCUPIED, session_status=ACTIVE, item_count=1
-- ===========================================================================
