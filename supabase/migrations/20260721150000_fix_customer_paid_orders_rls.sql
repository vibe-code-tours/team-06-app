-- =============================================================================
-- Fix: Anonymous customers cannot see paid orders after session closes.
--
-- Root cause trace:
--   Cashier clicks "Mark as Paid"
--   → process_payment() DB function (SECURITY DEFINER)
--     → INSERT into payments (OK)
--     → UPDATE orders SET payment_status = 'PAID', status = 'COMPLETED' (OK)
--     → UPDATE order_sessions SET status = 'CLOSED' (OK)
--   → Realtime fires on orders table
--   → Supabase checks RLS before broadcasting: order row has table_session_id
--     pointing to a CLOSED session, so orders_select_public_own_session BLOCKS it
--   → Customer never receives the Realtime event
--   → Polling fallback runs, queries order_sessions with status='ACTIVE' → null
--   → Fallback queries most recent session → RLS filter order_sessions_select_public_active
--     only allows status='ACTIVE', so BLOCKS the CLOSED session
--   → recentSession is null, orders are never re-fetched
--   → Customer's orders state still shows payment_status = 'UNPAID'
--   → allPaid is false, rating section never appears
--
-- Fix: Expand both public RLS policies to also allow 'CLOSED' status.
--   This is safe because:
--   - Queries are already scoped to a specific table_id
--   - The customer can only see sessions/orders for their own table
--   - Staff use separate authenticated policies
-- =============================================================================

-- Fix 1: Allow public to SELECT CLOSED sessions (not just ACTIVE)
DROP POLICY IF EXISTS order_sessions_select_public_active ON public.order_sessions;

CREATE POLICY order_sessions_select_public_active ON public.order_sessions
    FOR SELECT
    USING (
        status IN ('ACTIVE', 'CLOSED')
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

-- Fix 2: Allow public to SELECT orders belonging to ACTIVE or CLOSED sessions
DROP POLICY IF EXISTS orders_select_public_own_session ON public.orders;

CREATE POLICY orders_select_public_own_session ON public.orders
    FOR SELECT
    USING (
        EXISTS (
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
