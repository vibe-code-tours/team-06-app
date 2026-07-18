-- =============================================================================
-- Fix Issue #60: RLS policies leak cross-restaurant active orders
-- =============================================================================
-- Bug: orders_select_public_own_session, order_items_select_public_session,
-- and order_sessions_select_public_active allow ANY authenticated user to
-- read ANY restaurant's active data. Neither policy checks auth.uid() —
-- they only verify session.status = 'ACTIVE' or similar.
--
-- Because Postgres RLS policies combine with OR logic, authenticated staff
-- can invoke these "public" policies alongside their role-based policies,
-- leaking cross-restaurant data.
--
-- Fix: Scope public policies to auth.uid() IS NULL (anon-only requests).
-- This preserves anonymous customer order tracking while preventing
-- authenticated staff from reading other restaurants' data.
--
-- Impact:
--   - Anonymous customers (anon key) → can still poll order status ✅
--   - Authenticated staff → must use restaurant-scoped policies ✅
--   - Super_admin → has own ALL policy, unaffected ✅
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. DROP the broken policies
-- ---------------------------------------------------------------------------
-- Use IF EXISTS for idempotency (safe to run multiple times)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "orders_select_public_own_session" ON public.orders;
DROP POLICY IF EXISTS "order_items_select_public_session" ON public.order_items;
DROP POLICY IF EXISTS "order_sessions_select_public_active" ON public.order_sessions;


-- ---------------------------------------------------------------------------
-- 2. CREATE fixed policies scoped to anon-only (auth.uid() IS NULL)
-- ---------------------------------------------------------------------------
-- These policies allow anonymous users (Supabase anon key) to read orders
-- and order items for active sessions — required for customer order tracking.
--
-- Authenticated users (staff) cannot use these policies because
-- auth.uid() IS NOT NULL for them. They fall through to the
-- restaurant-scoped staff policies instead.
-- ---------------------------------------------------------------------------

-- Orders: anon-only read for active sessions (customer order tracking)
CREATE POLICY "orders_select_public_own_session"
    ON public.orders FOR SELECT
    USING (
        -- Only anon (unauthenticated) requests can use this policy
        auth.uid() IS NULL
        -- Order must belong to an active session in an active table/restaurant
        AND EXISTS (
            SELECT 1 FROM public.order_sessions s
            JOIN public.tables t ON s.table_id = t.id
            WHERE s.id = orders.table_session_id
            AND s.status = 'ACTIVE'
            AND t.is_active = true
            AND EXISTS (
                SELECT 1 FROM public.restaurants
                WHERE id = orders.restaurant_id AND is_active = true
            )
        )
    );

-- Order items: anon-only read for active sessions (customer order tracking)
CREATE POLICY "order_items_select_public_session"
    ON public.order_items FOR SELECT
    USING (
        -- Only anon (unauthenticated) requests can use this policy
        auth.uid() IS NULL
        -- Parent order must belong to an active session
        AND EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.order_sessions s ON o.table_session_id = s.id
            WHERE o.id = order_items.order_id
            AND s.status = 'ACTIVE'
        )
    );

-- Order sessions: anon-only read for active sessions (customer order tracking)
CREATE POLICY "order_sessions_select_public_active"
    ON public.order_sessions FOR SELECT
    USING (
        -- Only anon (unauthenticated) requests can use this policy
        auth.uid() IS NULL
        -- Session must be active in an active table/restaurant
        AND status = 'ACTIVE'
        AND EXISTS (
            SELECT 1 FROM public.tables
            WHERE id = order_sessions.table_id
            AND is_active = true
            AND EXISTS (
                SELECT 1 FROM public.restaurants
                WHERE id = order_sessions.restaurant_id AND is_active = true
            )
        )
    );


-- =============================================================================
-- Verification queries (run manually to confirm fix):
--
-- 1. As anon (customer): should still work
--    SELECT * FROM orders WHERE id = '<active-order-id>';
--
-- 2. As authenticated staff from Restaurant A: should return empty
--    SELECT * FROM orders WHERE id = '<restaurant-b-order-id>';
--
-- 3. As authenticated staff from Restaurant A: should work for own restaurant
--    SELECT * FROM orders WHERE restaurant_id = '<restaurant-a-id>';
-- =============================================================================
