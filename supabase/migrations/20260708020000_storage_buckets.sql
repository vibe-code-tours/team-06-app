-- =============================================================================
-- Storage Buckets: restaurant-logos, menu-images
-- =============================================================================
-- The initial schema migration documented these buckets in comments but did
-- not create them. Supabase Storage buckets and their RLS-style policies
-- live in the storage schema and can be created via SQL.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('restaurant-logos', 'restaurant-logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
    ('menu-images', 'menu-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Public read for both buckets (customer-facing menu and branding).
CREATE POLICY "public_read_restaurant_logos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'restaurant-logos');

CREATE POLICY "public_read_menu_images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'menu-images');

-- Restaurant owner/manager/super_admin can upload/update/delete logos for their restaurant.
-- Objects are stored under `{restaurant_id}/...` so the path prefix encodes ownership.
CREATE POLICY "restaurant_staff_write_logos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'restaurant-logos'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND (
                role = 'super_admin'
                OR (role IN ('restaurant_owner', 'manager') AND restaurant_id::text = (storage.foldername(name))[1])
            )
        )
    );

CREATE POLICY "restaurant_staff_update_logos"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'restaurant-logos'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND (
                role = 'super_admin'
                OR (role IN ('restaurant_owner', 'manager') AND restaurant_id::text = (storage.foldername(name))[1])
            )
        )
    );

CREATE POLICY "restaurant_staff_delete_logos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'restaurant-logos'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND (role = 'super_admin' OR role = 'restaurant_owner')
            AND restaurant_id::text = (storage.foldername(name))[1]
        )
    );

-- Restaurant owner/manager can upload/update menu item images for their restaurant.
CREATE POLICY "restaurant_staff_write_menu_images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'menu-images'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND (
                role = 'super_admin'
                OR (role IN ('restaurant_owner', 'manager') AND restaurant_id::text = (storage.foldername(name))[1])
            )
        )
    );

CREATE POLICY "restaurant_staff_update_menu_images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'menu-images'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND (
                role = 'super_admin'
                OR (role IN ('restaurant_owner', 'manager') AND restaurant_id::text = (storage.foldername(name))[1])
            )
        )
    );

CREATE POLICY "restaurant_staff_delete_menu_images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'menu-images'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND (role = 'super_admin' OR role = 'restaurant_owner')
            AND restaurant_id::text = (storage.foldername(name))[1]
        )
    );
