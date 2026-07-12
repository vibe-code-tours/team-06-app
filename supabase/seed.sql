-- =============================================================================
-- Development seed data
-- =============================================================================
-- Loaded automatically by `supabase db reset` (see supabase/config.toml [db.seed]).
-- This does NOT create a super_admin auth user — auth.users rows require the
-- GoTrue admin API, not plain SQL inserts, because passwords must be hashed
-- by GoTrue. To bootstrap a super_admin locally:
--   1. Sign up normally through the app (creates a 'customer' profile via
--      the handle_new_user trigger).
--   2. Run: UPDATE public.profiles SET role = 'super_admin' WHERE email = 'you@example.com';
-- =============================================================================

INSERT INTO public.restaurants (id, name, description, phone, email, address, tax_rate)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'The Local Bistro',
    'Seed restaurant for local development',
    '555-0100',
    'contact@localbistro.dev',
    '123 Dev Street',
    0.0825
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categories (id, restaurant_id, name, sort_order)
VALUES
    ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'Appetizers', 0),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Main Course', 1),
    ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'Desserts', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price)
VALUES
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 'Garlic Bread', 'Toasted with herb butter', 6.50),
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Grilled Salmon', 'With seasonal vegetables', 22.00),
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'Chocolate Cake', 'Warm, with vanilla ice cream', 8.00)
ON CONFLICT DO NOTHING;

INSERT INTO public.tables (restaurant_id, table_number, name, capacity)
VALUES
    ('00000000-0000-4000-8000-000000000001', 1, 'Window 1', 2),
    ('00000000-0000-4000-8000-000000000001', 2, 'Window 2', 4),
    ('00000000-0000-4000-8000-000000000001', 3, 'Patio 1', 6)
ON CONFLICT (restaurant_id, table_number) DO NOTHING;
