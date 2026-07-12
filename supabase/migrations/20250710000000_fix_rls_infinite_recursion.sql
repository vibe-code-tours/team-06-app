-- Fix infinite recursion in RLS policies by using SECURITY DEFINER helper functions
-- instead of inlining role checks that query the same table being protected.

-- ---------------------------------------------------------------------------
-- PROFILES policies — replace inline subqueries with user_has_role()
-- ---------------------------------------------------------------------------

-- Super admins can read all profiles
DROP POLICY IF EXISTS "profiles_select_super_admin" ON public.profiles;
CREATE POLICY "profiles_select_super_admin"
    ON public.profiles FOR SELECT
    USING (public.user_has_role('super_admin'));

-- Restaurant owners/managers can read profiles in their restaurant
DROP POLICY IF EXISTS "profiles_select_restaurant_staff" ON public.profiles;
CREATE POLICY "profiles_select_restaurant_staff"
    ON public.profiles FOR SELECT
    USING (
        public.user_has_role('restaurant_owner', 'manager')
        AND public.user_belongs_to_restaurant(profiles.restaurant_id)
    );

-- Super admins can update any profile
DROP POLICY IF EXISTS "profiles_update_super_admin" ON public.profiles;
CREATE POLICY "profiles_update_super_admin"
    ON public.profiles FOR UPDATE
    USING (public.user_has_role('super_admin'));

-- Restaurant owners/managers can update profiles in their restaurant
DROP POLICY IF EXISTS "profiles_update_restaurant_manager" ON public.profiles;
CREATE POLICY "profiles_update_restaurant_manager"
    ON public.profiles FOR UPDATE
    USING (
        public.user_has_role('restaurant_owner', 'manager')
        AND public.user_belongs_to_restaurant(profiles.restaurant_id)
    );

-- Super admins can insert profiles (for creating staff accounts)
DROP POLICY IF EXISTS "profiles_insert_super_admin" ON public.profiles;
CREATE POLICY "profiles_insert_super_admin"
    ON public.profiles FOR INSERT
    WITH CHECK (public.user_has_role('super_admin'));

-- Restaurant owners can insert profiles in their restaurant (invite staff)
DROP POLICY IF EXISTS "profiles_insert_restaurant_owner" ON public.profiles;
CREATE POLICY "profiles_insert_restaurant_owner"
    ON public.profiles FOR INSERT
    WITH CHECK (
        public.user_has_role('restaurant_owner')
        AND public.user_belongs_to_restaurant(profiles.restaurant_id)
    );
