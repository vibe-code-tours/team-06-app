-- Update order_ratings RLS policies to allow anonymous customer access.
-- The original migration created policies restricted to authenticated users,
-- but customers browse and order as anonymous users.

-- Drop old authenticated-only policies
DROP POLICY IF EXISTS order_ratings_insert_own_completed ON order_ratings;
DROP POLICY IF EXISTS order_ratings_select_own ON order_ratings;

-- Customers can insert a rating for their completed order (one per order)
-- Public policy because customers browse as anonymous users
CREATE POLICY order_ratings_insert_own_completed ON order_ratings
    FOR INSERT
    TO public
    WITH CHECK (
        order_id IN (
            SELECT o.id FROM orders o
            JOIN order_sessions s ON o.table_session_id = s.id
            WHERE o.id = order_id
              AND o.status = 'COMPLETED'
              AND s.id IS NOT NULL
        )
    );

-- Customers can read ratings (public — anon customers need this to check if they already rated)
DROP POLICY IF EXISTS order_ratings_select_public ON order_ratings;
CREATE POLICY order_ratings_select_public ON order_ratings
    FOR SELECT
    TO public
    USING (true);
