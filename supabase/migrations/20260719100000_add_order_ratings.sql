-- Order ratings table: customers rate their experience after order completion
CREATE TABLE order_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    food_quality_rating INTEGER CHECK (food_quality_rating >= 1 AND food_quality_rating <= 5),
    service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),
    feedback_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One rating per order
ALTER TABLE order_ratings ADD CONSTRAINT order_ratings_order_id_unique UNIQUE (order_id);

ALTER TABLE order_ratings ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY order_ratings_select_public ON order_ratings
    FOR SELECT
    TO public
    USING (true);

-- Staff with restaurant membership can read ratings for their restaurant
CREATE POLICY order_ratings_select_restaurant ON order_ratings
    FOR SELECT
    TO authenticated
    USING (
        user_belongs_to_restaurant(restaurant_id)
    );

-- Restaurant staff can read aggregate ratings (via the same select policy)
-- Aggregation is done in the application layer

CREATE INDEX idx_order_ratings_restaurant_id ON order_ratings (restaurant_id);
CREATE INDEX idx_order_ratings_order_id ON order_ratings (order_id);
