-- =============================================================================
-- Grant additional write permissions to authenticated role
-- =============================================================================
-- The initial grant migration only gave authenticated SELECT + limited writes.
-- RLS policies allow owner/manager/kitchen etc. to mutate rows, but the
-- underlying Postgres role must also have the corresponding table-level GRANT
-- or the operation is denied before RLS is even evaluated.
-- =============================================================================

-- Restaurants: owner/manager need INSERT (create) and UPDATE (edit settings)
GRANT INSERT, UPDATE ON public.restaurants TO authenticated;

-- Categories: owner/manager need INSERT/UPDATE/DELETE
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;

-- Menu items: owner/manager need INSERT/UPDATE/DELETE
GRANT INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;

-- Profiles: owner/manager need INSERT (invite staff)
GRANT INSERT ON public.profiles TO authenticated;

-- Payments: cashier/manager need INSERT
GRANT INSERT ON public.payments TO authenticated;

-- Order items: staff may need INSERT (direct add)
GRANT INSERT ON public.order_items TO authenticated;

-- Tables: owner/manager need INSERT/DELETE
GRANT INSERT, DELETE ON public.tables TO authenticated;

-- Sequences: ensure authenticated can use sequences for INSERT
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
