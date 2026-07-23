-- =============================================================================
-- Fix: Restore auth.uid() IS NULL guards on public RLS policies
-- =============================================================================
-- PR #67 added CLOSED status support for customer tracking/ratings but
-- dropped the auth.uid() IS NULL scope guard from Issue #60 fix.
--
-- This migration keeps Ma Win Pa Pa Thu's new features (CLOSED sessions,
-- ratings) while restoring cross-restaurant leak protection.
--
-- Changes:
--   1. order_sessions_select_public_active  → +auth.uid() IS NULL, +CLOSED
--   2. orders_select_public_own_session     → +auth.uid() IS NULL, +CLOSED
--   3. order_items_select_public_session    → +auth.uid() IS NULL, +CLOSED
--   4. order_ratings_insert_own_completed   → +auth.uid() IS NULL
--   5. order_ratings_select_public          → +auth.uid() IS NULL (was USING true)
--   6. DROP phantom order_ratings_select_own (never existed, safe no-op)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: DROP the phantom policy that never existed
-- (20260721100000 references order_ratings_select_own which was never created)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS order_ratings_select_own ON public.order_ratings;

-- ---------------------------------------------------------------------------
-- Step 2: DROP the 5 affected policies (with IF EXISTS for safety)
-- ---------------------------------------------------------------------------

-- Orders: public read for active/closed sessions
DROP POLICY IF EXISTS orders_select_public_own_session ON public.orders;

-- Order items: public read for active/closed sessions
DROP POLICY IF EXISTS order_items_select_public_session ON public.order_items;

-- Order sessions: public read for active/closed sessions
DROP POLICY IF EXISTS order_sessions_select_public_active ON public.order_sessions;

-- Ratings: public insert
DROP POLICY IF EXISTS order_ratings_insert_own_completed ON public.order_ratings;

-- Ratings: public select
DROP POLICY IF EXISTS order_ratings_select_public ON public.order_ratings;

-- ---------------------------------------------------------------------------
-- Step 3: RECREATE policies with auth.uid() IS NULL + CLOSED support
-- ---------------------------------------------------------------------------

-- Order sessions: anon-only read for active or closed sessions
-- (anon customers need this for post-payment tracking)
CREATE POLICY order_sessions_select_public_active ON public.order_sessions
    FOR SELECT
    TO public
    USING (
        auth.uid() IS NULL
        AND status IN ('ACTIVE', 'CLOSED')
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

-- Orders: anon-only read for active or closed sessions
-- (anon customers need this for post-payment confirmation page)
CREATE POLICY orders_select_public_own_session ON public.orders
    FOR SELECT
    TO public
    USING (
        auth.uid() IS NULL
        AND EXISTS (
            SELECT 1 FROM public.order_sessions s
            JOIN public.tables t ON s.table_id = t.id
            WHERE s.id = orders.table_session_id
            AND s.status IN ('ACTIVE', 'CLOSED')
            AND t.is_active = true
            AND EXISTS (
                SELECT 1 FROM public.restaurants
                WHERE id = orders.restaurant_id AND is_active = true
            )
        )
    );

-- Order items: anon-only read for active or closed sessions
-- (anon customers need this for post-payment order detail)
CREATE POLICY order_items_select_public_session ON public.order_items
    FOR SELECT
    TO public
    USING (
        auth.uid() IS NULL
        AND EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.order_sessions s ON o.table_session_id = s.id
            WHERE o.id = order_items.order_id
            AND s.status IN ('ACTIVE', 'CLOSED')
        )
    );

-- Ratings insert: anon-only, must be a completed order
-- (anon customers submit ratings after payment)
CREATE POLICY order_ratings_insert_own_completed ON public.order_ratings
    FOR INSERT
    TO public
    WITH CHECK (
        auth.uid() IS NULL
        AND order_id IN (
            SELECT o.id FROM orders o
            JOIN order_sessions s ON o.table_session_id = s.id
            WHERE o.id = order_id
              AND o.status = 'COMPLETED'
              AND s.id IS NOT NULL
        )
    );

-- Ratings select: anon-only read (staff use order_ratings_select_restaurant)
-- (anon customers check if they already rated)
CREATE POLICY order_ratings_select_public ON public.order_ratings
    FOR SELECT
    TO public
    USING (
        auth.uid() IS NULL
    );
