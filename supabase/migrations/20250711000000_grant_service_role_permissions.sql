-- Grant necessary permissions for RLS policies to work
-- Without these GRANTs, even with RLS policies allowing access,
-- the database role itself cannot read/write the tables.

-- service_role: full access (bypasses RLS)
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.restaurants TO service_role;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.menu_items TO service_role;
GRANT ALL ON public.tables TO service_role;
GRANT ALL ON public.order_sessions TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
GRANT ALL ON public.payments TO service_role;

-- anon: read access for public-facing data (restaurants, menus, tables)
GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT ON public.tables TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.order_sessions TO anon;
GRANT SELECT ON public.orders TO anon;
GRANT SELECT ON public.order_items TO anon;
GRANT SELECT ON public.payments TO anon;

-- authenticated: read access for all tables, write as needed by RLS
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.restaurants TO authenticated;
GRANT SELECT ON public.categories TO authenticated;
GRANT SELECT ON public.menu_items TO authenticated;
GRANT SELECT ON public.tables TO authenticated;
GRANT SELECT ON public.order_sessions TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.payments TO authenticated;

-- Grant INSERT/UPDATE/DELETE on tables that authenticated users write to
GRANT INSERT, UPDATE ON public.order_sessions TO authenticated;
GRANT INSERT, UPDATE ON public.orders TO authenticated;
GRANT INSERT ON public.order_items TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT UPDATE ON public.tables TO authenticated;

-- Grant usage on sequences (needed for INSERT with auto-generated IDs)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
