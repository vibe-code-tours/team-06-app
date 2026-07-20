-- =============================================================================
-- Anonymous Customer Ordering Fix — Cleanup Script
-- =============================================================================
-- Removes test data created by verify-anon-ordering-fix.sql
-- Run this after verification is complete.
--
-- Usage:
--   1. Run this script in Supabase SQL Editor
--   2. Verify test data is removed
-- =============================================================================

-- Use service_role for cleanup (bypasses RLS)
SET role = 'service_role';

-- Remove test data in reverse order (foreign key constraints)

-- 1. Order Items (depend on orders)
DELETE FROM public.order_items
WHERE order_id IN (
    SELECT id FROM public.orders
    WHERE restaurant_id = 'd0000000-0000-4000-8000-000000000001'
    AND customer_name = 'Anon Test Customer'
);

-- 2. Orders (depend on sessions)
DELETE FROM public.orders
WHERE restaurant_id = 'd0000000-0000-4000-8000-000000000001'
AND customer_name = 'Anon Test Customer';

-- 3. Sessions (depend on tables)
DELETE FROM public.order_sessions
WHERE table_id = 'd1000000-0000-4000-8000-000000000001';

-- 4. Menu Items (depend on categories)
DELETE FROM public.menu_items
WHERE id = 'd3000000-0000-4000-8000-000000000001';

-- 5. Categories (depend on restaurants)
DELETE FROM public.categories
WHERE id = 'd2000000-0000-4000-8000-000000000001';

-- 6. Tables (depend on restaurants)
DELETE FROM public.tables
WHERE id = 'd1000000-0000-4000-8000-000000000001';

-- 7. Restaurants (no dependencies)
DELETE FROM public.restaurants
WHERE id = 'd0000000-0000-4000-8000-000000000001';

-- Reset role
RESET role;

-- Verify cleanup
SELECT * FROM (
    SELECT 'Anon Ordering Cleanup Complete' AS message, '1 restaurant' AS removed
    UNION ALL SELECT '', '1 table'
    UNION ALL SELECT '', '1 category'
    UNION ALL SELECT '', '1 menu item'
    UNION ALL SELECT '', '0-1 sessions'
    UNION ALL SELECT '', '0-1 orders'
    UNION ALL SELECT '', '0-1 order items'
) AS cleanup_summary;
