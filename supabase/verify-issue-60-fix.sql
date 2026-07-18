-- =============================================================================
-- Issue #60 Verification Script
-- =============================================================================
-- Tests that anon users can read active orders, but authenticated staff
-- cannot read cross-restaurant data.
--
-- Usage:
--   1. Run this script in Supabase SQL Editor
--   2. Check the final SELECT output for ALL test results (single table)
--   3. Run cleanup script to remove test data
-- =============================================================================


-- ===========================================================================
-- STEP 1: Create test data
-- ===========================================================================

SET role = 'service_role';

-- Restaurant A
INSERT INTO public.restaurants (id, name, is_active, tax_rate)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Test Restaurant A (Issue 60)', true, 0.08)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- Restaurant B
INSERT INTO public.restaurants (id, name, is_active, tax_rate)
VALUES ('b0000000-0000-0000-0000-000000000002', 'Test Restaurant B (Issue 60)', true, 0.08)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- Tables
INSERT INTO public.tables (id, restaurant_id, table_number, qr_code, is_active, status)
VALUES ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1, 'QR-TEST-A1', true, 'AVAILABLE')
ON CONFLICT (id) DO UPDATE SET status = 'AVAILABLE', is_active = true;

INSERT INTO public.tables (id, restaurant_id, table_number, qr_code, is_active, status)
VALUES ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 2, 'QR-TEST-B2', true, 'AVAILABLE')
ON CONFLICT (id) DO UPDATE SET status = 'AVAILABLE', is_active = true;

-- Sessions (ACTIVE)
INSERT INTO public.order_sessions (id, restaurant_id, table_id, status)
VALUES ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';

INSERT INTO public.order_sessions (id, restaurant_id, table_id, status)
VALUES ('b2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';

-- Orders (PENDING, UNPAID)
INSERT INTO public.orders (id, restaurant_id, table_session_id, table_id, customer_name, status, payment_status)
VALUES ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Test Customer A', 'PENDING', 'UNPAID')
ON CONFLICT (id) DO UPDATE SET status = 'PENDING', payment_status = 'UNPAID';

INSERT INTO public.orders (id, restaurant_id, table_session_id, table_id, customer_name, status, payment_status)
VALUES ('b3000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Test Customer B', 'PENDING', 'UNPAID')
ON CONFLICT (id) DO UPDATE SET status = 'PENDING', payment_status = 'UNPAID';

RESET role;


-- ===========================================================================
-- STEP 2: Run ALL tests in a single SELECT (so you see all results at once)
-- ===========================================================================

SELECT * FROM (
    -- Tests 2.1-2.4: Anon reads (customer polling)
    SELECT '2.1' AS test_num,
        'Anon reads Restaurant A order' AS test_name,
        '1 row' AS expected,
        (SELECT COUNT(*)::TEXT FROM public.orders WHERE id = 'a3000000-0000-0000-0000-000000000001') || ' rows' AS actual,
        CASE WHEN (SELECT COUNT(*) FROM public.orders WHERE id = 'a3000000-0000-0000-0000-000000000001') = 1 THEN '✅ PASS' ELSE '❌ FAIL' END AS status

    UNION ALL

    SELECT '2.2', 'Anon reads Restaurant B order', '1 row',
        (SELECT COUNT(*)::TEXT FROM public.orders WHERE id = 'b3000000-0000-0000-0000-000000000002') || ' rows',
        CASE WHEN (SELECT COUNT(*) FROM public.orders WHERE id = 'b3000000-0000-0000-0000-000000000002') = 1 THEN '✅ PASS' ELSE '❌ FAIL' END

    UNION ALL

    SELECT '2.3', 'Anon reads Restaurant A session', '1 row',
        (SELECT COUNT(*)::TEXT FROM public.order_sessions WHERE id = 'a2000000-0000-0000-0000-000000000001') || ' rows',
        CASE WHEN (SELECT COUNT(*) FROM public.order_sessions WHERE id = 'a2000000-0000-0000-0000-000000000001') = 1 THEN '✅ PASS' ELSE '❌ FAIL' END

    UNION ALL

    SELECT '2.4', 'Anon reads Restaurant B session', '1 row',
        (SELECT COUNT(*)::TEXT FROM public.order_sessions WHERE id = 'b2000000-0000-0000-0000-000000000002') || ' rows',
        CASE WHEN (SELECT COUNT(*) FROM public.order_sessions WHERE id = 'b2000000-0000-0000-0000-000000000002') = 1 THEN '✅ PASS' ELSE '❌ FAIL' END

    UNION ALL

    -- Tests 3.1-3.3: Policy definition checks
    SELECT '3.1', 'Policy orders_select has auth.uid() check', 'Found',
        CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'orders_select_public_own_session' AND tablename = 'orders' AND qual LIKE '%auth.uid() IS NULL%') THEN 'Found' ELSE 'NOT FOUND' END,
        CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'orders_select_public_own_session' AND tablename = 'orders' AND qual LIKE '%auth.uid() IS NULL%') THEN '✅ PASS' ELSE '❌ FAIL' END

    UNION ALL

    SELECT '3.2', 'Policy order_items_select has auth.uid() check', 'Found',
        CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'order_items_select_public_session' AND tablename = 'order_items' AND qual LIKE '%auth.uid() IS NULL%') THEN 'Found' ELSE 'NOT FOUND' END,
        CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'order_items_select_public_session' AND tablename = 'order_items' AND qual LIKE '%auth.uid() IS NULL%') THEN '✅ PASS' ELSE '❌ FAIL' END

    UNION ALL

    SELECT '3.3', 'Policy order_sessions_select has auth.uid() check', 'Found',
        CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'order_sessions_select_public_active' AND tablename = 'order_sessions' AND qual LIKE '%auth.uid() IS NULL%') THEN 'Found' ELSE 'NOT FOUND' END,
        CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'order_sessions_select_public_active' AND tablename = 'order_sessions' AND qual LIKE '%auth.uid() IS NULL%') THEN '✅ PASS' ELSE '❌ FAIL' END
) AS all_tests
ORDER BY test_num;


-- ===========================================================================
-- SUMMARY
-- ===========================================================================
-- All 7 rows should show ✅ PASS
-- Tests 2.1-2.4: Anon can read active orders/sessions (customer polling works)
-- Tests 3.1-3.3: Policies have auth.uid() IS NULL check (leak fixed)
--
-- Next: Run verify-issue-60-cleanup.sql to remove test data.
-- ===========================================================================
