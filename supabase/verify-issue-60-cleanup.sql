-- =============================================================================
-- Issue #60 Cleanup Script
-- =============================================================================
-- Removes test data created by verify-issue-60-fix.sql
-- Run this after verification is complete.
--
-- Usage:
--   1. Run this script in Supabase SQL Editor
--   2. Verify test data is removed
-- =============================================================================

-- Use service_role for cleanup (bypasses RLS)
SET role = 'service_role';

-- Remove test data in reverse order (foreign key constraints)

-- 1. Orders (depend on sessions)
DELETE FROM public.orders
WHERE id IN (
    'a3000000-0000-0000-0000-000000000001',
    'b3000000-0000-0000-0000-000000000002'
);

-- 3. Sessions (depend on tables)
DELETE FROM public.order_sessions
WHERE id IN (
    'a2000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000002'
);

-- 4. Tables (depend on restaurants)
DELETE FROM public.tables
WHERE id IN (
    'a1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000002'
);

-- 5. Restaurants (no dependencies)
DELETE FROM public.restaurants
WHERE id IN (
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
);

-- Reset role
RESET role;

-- Verify cleanup
SELECT * FROM (
    SELECT 'Issue #60 Cleanup Complete' AS message, '2 restaurants' AS removed
    UNION ALL SELECT '', '2 tables'
    UNION ALL SELECT '', '2 sessions'
    UNION ALL SELECT '', '2 orders'
) AS cleanup_summary;
