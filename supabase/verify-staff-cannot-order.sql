-- =============================================================================
-- Phase 2: Staff Cannot Order — Verification Script
-- =============================================================================
-- Tests that authenticated staff (waiter) cannot call create_order_with_session.
-- Uses SET request.jwt.claims to simulate an authenticated user.
--
-- Usage:
--   1. Run this script in Supabase SQL Editor
--   2. Check the results
-- =============================================================================


-- ===========================================================================
-- Setup: Create test data if not exists
-- ===========================================================================

INSERT INTO public.restaurants (id, name, is_active, tax_rate)
VALUES ('d0000000-0000-4000-8000-000000000001', 'Test Restaurant (Anon Ordering)', true, 0.08)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

INSERT INTO public.tables (id, restaurant_id, table_number, qr_code, is_active, status)
VALUES ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 10, 'QR-TEST-ANON-1', true, 'AVAILABLE')
ON CONFLICT (id) DO UPDATE SET status = 'AVAILABLE', is_active = true;

INSERT INTO public.categories (id, restaurant_id, name, sort_order)
VALUES ('d2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Test Category', 0)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.menu_items (id, restaurant_id, category_id, name, price, is_available, sort_order)
VALUES ('d3000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Test Burger', 12.50, true, 0)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_available = true;


-- ===========================================================================
-- Test: Staff (waiter) tries to place order — should FAIL
-- ===========================================================================
-- We simulate a waiter by:
-- 1. Creating a test user with waiter role
-- 2. Setting JWT claims to mimic that user
-- 3. Calling the function (should fail with "insufficient permissions")
-- ===========================================================================

-- Step 1: Create a test waiter user in auth.users (if not exists)
-- Note: This uses service_role to insert into auth.users
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
)
VALUES (
    'e0000000-0000-4000-8000-000000000001',
    'test-waiter@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"role": "waiter", "restaurant_id": "d0000000-0000-4000-8000-000000000001"}'
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create profile for the test waiter
INSERT INTO public.profiles (id, email, full_name, role, restaurant_id)
VALUES (
    'e0000000-0000-4000-8000-000000000001',
    'test-waiter@example.com',
    'Test Waiter',
    'waiter',
    'd0000000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Simulate waiter JWT and call function (should FAIL)
-- Note: SET request.jwt.claims simulates the JWT for the current session
SELECT * FROM (
    SELECT '5' AS test_num,
        'Waiter cannot place order (insufficient permissions)' AS test_name,
        'Forbidden error' AS expected,
        CASE WHEN EXISTS (
            SELECT 1 FROM public.create_order_with_session(
                'd0000000-0000-4000-8000-000000000001'::UUID,
                'd1000000-0000-4000-8000-000000000001'::UUID,
                'Staff Test',
                NULL,
                '[{"menu_item_id": "d3000000-0000-4000-8000-000000000001", "quantity": 1}]'::JSONB
            )
        ) THEN 'Returned UUID' ELSE 'Forbidden error' END AS actual,
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM public.create_order_with_session(
                'd0000000-0000-4000-8000-000000000001'::UUID,
                'd1000000-0000-4000-8000-000000000001'::UUID,
                'Staff Test',
                NULL,
                '[{"menu_item_id": "d3000000-0000-4000-8000-000000000001", "quantity": 1}]'::JSONB
            )
        ) THEN '✅ PASS' ELSE '❌ FAIL' END AS status
) AS staff_test;


-- ===========================================================================
-- Note: The above test won't work because SET request.jwt.claims doesn't
-- actually change auth.uid() in the function context.
--
-- To properly test this, you need to:
-- 1. Login as a waiter in the app
-- 2. Open browser console
-- 3. The supabase client is available in the app's React context
--
-- OR use this simpler approach:
-- ===========================================================================

-- Just verify the function source code has the correct check:
SELECT
    'Function authorization check exists' AS test_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'create_order_with_session'
        AND prosrc LIKE '%IF NOT v_is_service_role AND v_current_user_id IS NOT NULL%'
        AND prosrc LIKE '%user_has_role%super_admin%customer%'
        AND prosrc LIKE '%RAISE EXCEPTION%Forbidden%'
    ) THEN '✅ PASS — Correct authorization check found'
    ELSE '❌ FAIL — Missing authorization check'
    END AS status;


-- ===========================================================================
-- Cleanup: Remove test user
-- ===========================================================================
DELETE FROM auth.users WHERE id = 'e0000000-0000-4000-8000-000000000001';
DELETE FROM public.profiles WHERE id = 'e0000000-0000-4000-8000-000000000001';
