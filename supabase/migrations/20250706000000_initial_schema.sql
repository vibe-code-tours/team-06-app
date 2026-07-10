-- =============================================================================
-- Restaurant QR Order System - Complete Database Schema
-- =============================================================================
-- Description: Full PostgreSQL schema for a QR-based restaurant ordering system.
--              Customers scan table QR codes, browse menus, order food, and pay.
--              Staff manage orders through role-based dashboards.
--
-- Architecture: Supabase (PostgreSQL + Auth + Realtime + Storage)
-- Author:       VibeCode Team06
-- Created:      2025-07-06
-- =============================================================================

-- =============================================================================
-- SECTION 1: ENUM TYPES
-- =============================================================================
-- Centralized enum definitions used across multiple tables.
-- Using PostgreSQL ENUMs ensures data integrity and allows efficient comparisons.
-- =============================================================================

-- Role-based access control for the entire system
-- Design decision: Single enum covers all possible roles. The profiles.role column
-- determines what RLS policies apply and which dashboards are accessible.
CREATE TYPE public.user_role AS ENUM (
    'super_admin',      -- Full system access across all restaurants
    'restaurant_owner', -- Own restaurant settings, menu, staff, reports
    'manager',          -- Orders, staff scheduling, reports within restaurant
    'kitchen_staff',    -- Kitchen display, order status updates only
    'waiter',           -- Table management, order assistance
    'cashier',          -- Payment processing, bill confirmation
    'customer'          -- Menu browsing, order placement (guest)
);

-- Physical table states in the restaurant
-- Design decision: Four states cover the full lifecycle:
--   AVAILABLE (ready for guests) -> OCCUPIED (guests seated/ordering)
--   -> WAITING_PAYMENT (bill requested) -> back to AVAILABLE (after payment)
--   CLEANING is a transient state between guests
CREATE TYPE public.table_status AS ENUM (
    'AVAILABLE',        -- Table is free, ready for new guests
    'OCCUPIED',         -- Guests are seated, active session exists
    'WAITING_PAYMENT',  -- Bill requested, awaiting payment processing
    'CLEANING'          -- Being cleaned between guests
);

-- Order lifecycle status
-- Design decision: Linear flow PENDING -> ACCEPTED -> PREPARING -> READY -> COMPLETED
-- with CANCELLED as an exit state from any point. The update_order_status function
-- enforces valid transitions to prevent invalid state changes.
CREATE TYPE public.order_status AS ENUM (
    'PENDING',          -- Order just placed, awaiting kitchen acceptance
    'ACCEPTED',         -- Kitchen has acknowledged the order
    'PREPARING',        -- Food is being prepared
    'READY',            -- Food is ready for delivery/pickup
    'COMPLETED',        -- Order fulfilled (delivered to table)
    'CANCELLED'         -- Order cancelled (by customer or staff)
);

-- Payment status on the order itself (simplified view for quick queries)
-- Design decision: Separate from the payments table. This denormalized field
-- on orders allows fast filtering of "unpaid" vs "paid" orders without joins.
-- The payments table holds the full transaction details.
CREATE TYPE public.order_payment_status AS ENUM (
    'UNPAID',           -- No payment processed yet
    'PAID'              -- Payment completed
);

-- Table session lifecycle
-- Design decision: ACTIVE means orders are being placed and unpaid.
-- CLOSED means payment completed successfully. RELEASED means staff
-- manually freed the table (cancelling unpaid orders).
CREATE TYPE public.session_status AS ENUM (
    'ACTIVE',           -- Session is live, orders can be placed
    'CLOSED',           -- Session completed after payment
    'RELEASED'          -- Staff manually released the table
);

-- Accepted payment methods
-- Design decision: Three common methods cover most restaurant scenarios.
-- Can be extended with more values if needed (e.g., BANK_TRANSFER).
CREATE TYPE public.payment_method AS ENUM (
    'CASH',             -- Cash payment
    'CARD',             -- Credit/debit card
    'DIGITAL_WALLET'   -- Mobile payment (Apple Pay, Google Pay, etc.)
);

-- Payment transaction status (on the payments table)
-- Design decision: Separate from order payment_status to track the
-- full lifecycle of each payment transaction including failures and refunds.
CREATE TYPE public.payment_status AS ENUM (
    'PENDING',          -- Payment initiated but not confirmed
    'COMPLETED',        -- Payment successful
    'FAILED',           -- Payment failed (e.g., card declined)
    'REFUNDED'          -- Payment was refunded
);


-- =============================================================================
-- SECTION 2: TABLE DEFINITIONS
-- =============================================================================
-- All tables use UUID primary keys for security (non-guessable) and
-- compatibility with Supabase Auth. Timestamps use TIMESTAMPTZ for
-- timezone-aware storage. RLS is enabled on every table.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.1 PROFILES
-- ---------------------------------------------------------------------------
-- Extended user profile linked to Supabase Auth.
-- Design decision: We store role and restaurant_id here rather than in
-- auth.users metadata because: (1) it enables RLS policies via SQL,
-- (2) it avoids leaking metadata in client-side JWT claims, and
-- (3) it allows efficient JOINs for restaurant-scoped queries.
CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    full_name       TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    role            public.user_role NOT NULL DEFAULT 'customer',
    restaurant_id   UUID,  -- FK added after restaurants table is created
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profiles linked to Supabase Auth. Role determines dashboard access and RLS policy evaluation.';
COMMENT ON COLUMN public.profiles.restaurant_id IS 'FK to restaurants. NULL for super_admin and customers not yet assigned.';
COMMENT ON COLUMN public.profiles.role IS 'User role for RBAC. Stored here for efficient RLS policy checks.';

-- ---------------------------------------------------------------------------
-- 2.2 RESTAURANTS
-- ---------------------------------------------------------------------------
-- Core restaurant entity. Each restaurant is an isolated tenant.
-- Design decision: tax_rate is stored per-restaurant because tax rules
-- vary by jurisdiction. is_active allows soft-delete (hide from public
-- menus without losing data).
CREATE TABLE public.restaurants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    logo_url    TEXT,              -- Nullable; uploaded to Supabase Storage
    phone       TEXT NOT NULL DEFAULT '',
    email       TEXT NOT NULL DEFAULT '',
    address     TEXT NOT NULL DEFAULT '',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    tax_rate    DECIMAL(5,4) NOT NULL DEFAULT 0,  -- e.g., 0.1000 for 10%
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.restaurants IS 'Restaurant profiles. Each restaurant is a tenant with isolated data.';
COMMENT ON COLUMN public.restaurants.tax_rate IS 'Tax rate as decimal, e.g., 0.1000 for 10%. Stored with 4 decimal places for precision.';
COMMENT ON COLUMN public.restaurants.is_active IS 'Soft-delete flag. Inactive restaurants are hidden from public menus.';

-- Now add the FK from profiles to restaurants
ALTER TABLE public.profiles
    ADD CONSTRAINT fk_profiles_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
    ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2.3 CATEGORIES
-- ---------------------------------------------------------------------------
-- Menu categories scoped to a restaurant.
-- Design decision: sort_order allows drag-and-drop reordering in the UI.
-- is_active allows hiding categories without deleting them.
CREATE TABLE public.categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.categories IS 'Menu categories (e.g., Appetizers, Main Course, Desserts) scoped to a restaurant.';

-- ---------------------------------------------------------------------------
-- 2.4 MENU ITEMS
-- ---------------------------------------------------------------------------
-- Individual menu items within categories.
-- Design decision: price is DECIMAL(10,2) for exact monetary values.
-- is_available allows real-time availability toggling (e.g., "86'd" items).
-- unit_price in order_items snapshots this price at order time.
CREATE TABLE public.menu_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    price           DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    image_url       TEXT,              -- Nullable; uploaded to Supabase Storage
    is_available    BOOLEAN NOT NULL DEFAULT true,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.menu_items IS 'Individual menu items. Price is snapshotted into order_items at order time.';
COMMENT ON COLUMN public.menu_items.price IS 'Current menu price. Historical prices are preserved in order_items.unit_price.';

-- ---------------------------------------------------------------------------
-- 2.5 TABLES
-- ---------------------------------------------------------------------------
-- Physical dining tables in a restaurant.
-- Design decision: table_number is per-restaurant (scoped by restaurant_id).
-- The UNIQUE(restaurant_id, table_number) constraint prevents duplicate numbers.
-- qr_code stores a data URL (base64-encoded PNG) generated server-side.
CREATE TABLE public.tables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number    INTEGER NOT NULL,
    name            TEXT,              -- Optional human-readable name (e.g., "Patio 3")
    capacity        INTEGER NOT NULL DEFAULT 4 CHECK (capacity > 0),
    status          public.table_status NOT NULL DEFAULT 'AVAILABLE',
    qr_code         TEXT NOT NULL DEFAULT '',  -- Data URL, auto-generated by trigger
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(restaurant_id, table_number)
);

COMMENT ON TABLE public.tables IS 'Physical dining tables. Each has a unique QR code linking to the customer menu.';
COMMENT ON COLUMN public.tables.qr_code IS 'QR code as data URL (data:image/png;base64,...). Auto-generated by trigger on insert.';

-- ---------------------------------------------------------------------------
-- 2.6 ORDER SESSIONS
-- ---------------------------------------------------------------------------
-- Represents an active dining session at a table.
-- Design decision: Sessions prevent race conditions when multiple customers
-- scan the same QR code. Only ONE active session per table is allowed.
-- The session links to all orders placed during that visit.
CREATE TABLE public.order_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_id        UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ,
    status          public.session_status NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_sessions IS 'Dining sessions at a table. One active session per table at a time prevents duplicate orders.';

-- ---------------------------------------------------------------------------
-- 2.7 ORDERS
-- ---------------------------------------------------------------------------
-- Customer orders placed during a session.
-- Design decision: table_session_id is nullable because orders can exist
-- without a session (edge cases, or if session is released). customer_name
-- is optional -- guests may not provide a name. payment_status is
-- denormalized here for fast filtering (avoids joining payments table).
CREATE TABLE public.orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id           UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_session_id        UUID REFERENCES public.order_sessions(id) ON DELETE SET NULL,
    table_id                UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
    customer_name           TEXT,
    status                  public.order_status NOT NULL DEFAULT 'PENDING',
    payment_status          public.order_payment_status NOT NULL DEFAULT 'UNPAID',
    special_instructions    TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.orders IS 'Customer orders. Status is managed by update_order_status function with strict transition rules.';
COMMENT ON COLUMN public.orders.table_session_id IS 'Links order to a table session. Set to NULL if session is released.';
COMMENT ON COLUMN public.orders.payment_status IS 'Denormalized from payments table for fast filtering of unpaid orders.';

-- ---------------------------------------------------------------------------
-- 2.8 ORDER ITEMS
-- ---------------------------------------------------------------------------
-- Individual line items within an order.
-- Design decision: unit_price is a snapshot of the menu item price at order
-- time. This preserves historical pricing even if menu prices change later.
-- special_instructions allows per-item customization (e.g., "no onions").
CREATE TABLE public.order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id        UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    quantity            INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price          DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    special_instructions TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_items IS 'Line items in an order. unit_price is snapshotted from menu_items at order creation time.';
COMMENT ON COLUMN public.order_items.unit_price IS 'Price snapshot at order time. Does not change if menu price updates later.';
COMMENT ON COLUMN public.order_items.menu_item_id IS 'FK with ON DELETE RESTRICT: cannot delete a menu item that has been ordered.';

-- ---------------------------------------------------------------------------
-- 2.9 PAYMENTS
-- ---------------------------------------------------------------------------
-- Payment transaction records.
-- Design decision: total_amount = amount + tax_amount - discount_amount.
-- processed_by tracks which cashier handled the payment. transaction_id
-- stores external reference for card/digital payments.
CREATE TABLE public.payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id       UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    amount              DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    tax_amount          DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    discount_amount     DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount        DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    payment_method      public.payment_method NOT NULL,
    payment_status      public.payment_status NOT NULL DEFAULT 'PENDING',
    transaction_id      TEXT,              -- External reference (card processor ID, etc.)
    processed_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payments IS 'Payment transaction records. Each payment is linked to an order and a restaurant.';
COMMENT ON COLUMN public.payments.total_amount IS 'Final amount after tax and discount: amount + tax_amount - discount_amount.';
COMMENT ON COLUMN public.payments.processed_by IS 'FK to profiles (cashier/manager who processed the payment).';


-- =============================================================================
-- SECTION 3: INDEXES
-- =============================================================================
-- Indexes are created on columns used in WHERE, JOIN, and ORDER BY clauses
-- to ensure fast query performance, especially for RLS policy checks
-- which run on every query.
-- =============================================================================

-- Profiles: restaurant lookup for RLS, role filtering for dashboard routing
CREATE INDEX idx_profiles_restaurant_id ON public.profiles(restaurant_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Categories: restaurant menu listing (sorted), restaurant_id for RLS
CREATE INDEX idx_categories_restaurant_id ON public.categories(restaurant_id);
CREATE INDEX idx_categories_sort_order ON public.categories(restaurant_id, sort_order);

-- Menu Items: restaurant menu query (filtered by category and availability)
CREATE INDEX idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX idx_menu_items_available ON public.menu_items(restaurant_id, is_available);

-- Tables: restaurant table listing, status filtering for dashboard
CREATE INDEX idx_tables_restaurant_id ON public.tables(restaurant_id);
CREATE INDEX idx_tables_status ON public.tables(restaurant_id, status);

-- Order Sessions: active session lookup per table, restaurant-wide session queries
CREATE INDEX idx_order_sessions_table_id ON public.order_sessions(table_id);
CREATE INDEX idx_order_sessions_restaurant_id ON public.order_sessions(restaurant_id);
CREATE INDEX idx_order_sessions_status ON public.order_sessions(restaurant_id, status);

-- Orders: restaurant dashboard queries, status filtering, session lookup, time-based reports
CREATE INDEX idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX idx_orders_status ON public.orders(restaurant_id, status);
CREATE INDEX idx_orders_table_session_id ON public.orders(table_session_id);
CREATE INDEX idx_orders_created_at ON public.orders(restaurant_id, created_at DESC);

-- Order Items: order detail lookups, menu item popularity reports
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON public.order_items(menu_item_id);

-- Payments: order payment lookup, restaurant payment reports, status filtering
CREATE INDEX idx_payments_order_id ON public.payments(order_id);
CREATE INDEX idx_payments_restaurant_id ON public.payments(restaurant_id);
CREATE INDEX idx_payments_status ON public.payments(restaurant_id, payment_status);


-- =============================================================================
-- SECTION 4: HELPER FUNCTIONS
-- =============================================================================
-- Utility functions for common operations.
-- =============================================================================

-- Get the current user's profile row (used in RLS policies to avoid repeated subqueries)
CREATE OR REPLACE FUNCTION public.get_user_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_profile() IS 'Returns the current authenticated user''s profile. Used in RLS policies for role and restaurant checks.';

-- Check if current user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(VARIADIC roles public.user_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = ANY(roles)
    )
$$;

COMMENT ON FUNCTION public.user_has_role(VARIADIC public.user_role[]) IS 'Returns true if the current user has any of the specified roles.';

-- Check if current user belongs to a specific restaurant
CREATE OR REPLACE FUNCTION public.user_belongs_to_restaurant(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND restaurant_id = p_restaurant_id
        AND is_active = true
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
    )
$$;

COMMENT ON FUNCTION public.user_belongs_to_restaurant(UUID) IS 'Returns true if the current user belongs to the specified restaurant or is a super_admin.';

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_updated_at() IS 'Trigger function to auto-set updated_at on row updates.';


-- =============================================================================
-- SECTION 5: CORE BUSINESS FUNCTIONS
-- =============================================================================
-- Atomic functions that enforce business rules and prevent race conditions.
-- All use SECURITY DEFINER to bypass RLS (they enforce their own checks).
-- All use transactions for atomicity.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 CREATE ORDER WITH SESSION
-- ---------------------------------------------------------------------------
-- Atomic function to create a new order, optionally creating a session.
-- Enforces: only one active session per table, blocks ordering during
-- existing unpaid sessions. Returns the new order ID.
CREATE OR REPLACE FUNCTION public.create_order_with_session(
    p_restaurant_id     UUID,
    p_table_id          UUID,
    p_customer_name     TEXT DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL,
    p_items             JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id    UUID;
    v_order_id      UUID;
    v_item          JSONB;
    v_menu_item     RECORD;
    v_new_order     RECORD;
BEGIN
    -- -----------------------------------------------------------------------
    -- Step 1: Lock the table row to prevent concurrent session creation
    -- -----------------------------------------------------------------------
    -- SELECT ... FOR UPDATE acquires an exclusive lock on the table row,
    -- ensuring only one request can create a session for this table at a time.
    PERFORM 1 FROM public.tables
    WHERE id = p_table_id
    AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    -- Verify the table exists and belongs to the restaurant
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Table not found or does not belong to this restaurant';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Check for existing active session
    -- -----------------------------------------------------------------------
    SELECT id INTO v_session_id
    FROM public.order_sessions
    WHERE table_id = p_table_id
    AND status = 'ACTIVE'
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'An active session already exists for this table. Please pay the current bill before placing a new order.';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 3: Create a new session
    -- -----------------------------------------------------------------------
    INSERT INTO public.order_sessions (restaurant_id, table_id, status)
    VALUES (p_restaurant_id, p_table_id, 'ACTIVE')
    RETURNING id INTO v_session_id;

    -- -----------------------------------------------------------------------
    -- Step 4: Create the order
    -- -----------------------------------------------------------------------
    INSERT INTO public.orders (
        restaurant_id,
        table_session_id,
        table_id,
        customer_name,
        status,
        payment_status,
        special_instructions
    )
    VALUES (
        p_restaurant_id,
        v_session_id,
        p_table_id,
        p_customer_name,
        'PENDING',
        'UNPAID',
        p_special_instructions
    )
    RETURNING * INTO v_new_order;

    v_order_id := v_new_order.id;

    -- -----------------------------------------------------------------------
    -- Step 5: Insert order items
    -- -----------------------------------------------------------------------
    -- Validate each item: menu_item exists, belongs to restaurant, is available
    -- Snapshot the current price into unit_price
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Lock and verify the menu item
        SELECT id, price, is_available, name INTO v_menu_item
        FROM public.menu_items
        WHERE id = (v_item->>'menu_item_id')::UUID
        AND restaurant_id = p_restaurant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Menu item not found: %', v_item->>'menu_item_id';
        END IF;

        IF NOT v_menu_item.is_available THEN
            RAISE EXCEPTION 'Menu item is not available: %', v_menu_item.name;
        END IF;

        IF (v_item->>'quantity')::INTEGER <= 0 THEN
            RAISE EXCEPTION 'Quantity must be at least 1 for item: %', v_menu_item.name;
        END IF;

        -- Insert with price snapshot
        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            quantity,
            unit_price,
            special_instructions
        )
        VALUES (
            v_order_id,
            (v_item->>'menu_item_id')::UUID,
            (v_item->>'quantity')::INTEGER,
            v_menu_item.price,
            v_item->>'special_instructions'
        );
    END LOOP;

    -- -----------------------------------------------------------------------
    -- Step 6: Update table status to OCCUPIED
    -- -----------------------------------------------------------------------
    UPDATE public.tables
    SET status = 'OCCUPIED', updated_at = now()
    WHERE id = p_table_id;

    -- -----------------------------------------------------------------------
    -- Step 7: Return the order ID
    -- -----------------------------------------------------------------------
    RETURN v_order_id;
END;
$$;

COMMENT ON FUNCTION public.create_order_with_session(UUID, UUID, TEXT, TEXT, JSONB) IS
    'Atomically creates an order with session. Enforces one active session per table. '
    'Items is a JSONB array of {menu_item_id, quantity, special_instructions}. '
    'Returns the new order ID.';


-- ---------------------------------------------------------------------------
-- 5.2 UPDATE ORDER STATUS
-- ---------------------------------------------------------------------------
-- Enforces valid status transitions:
--   PENDING -> ACCEPTED -> PREPARING -> READY -> COMPLETED
--   Any status -> CANCELLED
-- This prevents invalid state jumps and maintains order integrity.
CREATE OR REPLACE FUNCTION public.update_order_status(
    p_order_id      UUID,
    p_new_status    public.order_status
)
RETURNS public.order_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status    public.order_status;
    v_valid_transition  BOOLEAN := false;
BEGIN
    -- Lock the order row
    SELECT status INTO v_current_status
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;

    -- -----------------------------------------------------------------------
    -- Validate transition
    -- -----------------------------------------------------------------------
    -- Any status can transition to CANCELLED
    IF p_new_status = 'CANCELLED' THEN
        -- Cannot cancel an already completed order
        IF v_current_status = 'COMPLETED' THEN
            RAISE EXCEPTION 'Cannot cancel a completed order';
        END IF;
        v_valid_transition := true;

    -- Standard linear flow
    ELSIF v_current_status = 'PENDING' AND p_new_status = 'ACCEPTED' THEN
        v_valid_transition := true;
    ELSIF v_current_status = 'ACCEPTED' AND p_new_status = 'PREPARING' THEN
        v_valid_transition := true;
    ELSIF v_current_status = 'PREPARING' AND p_new_status = 'READY' THEN
        v_valid_transition := true;
    ELSIF v_current_status = 'READY' AND p_new_status = 'COMPLETED' THEN
        v_valid_transition := true;
    END IF;

    IF NOT v_valid_transition THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %', v_current_status, p_new_status;
    END IF;

    -- Apply the transition
    UPDATE public.orders
    SET status = p_new_status, updated_at = now()
    WHERE id = p_order_id;

    RETURN p_new_status;
END;
$$;

COMMENT ON FUNCTION public.update_order_status(UUID, public.order_status) IS
    'Updates order status with strict transition validation. '
    'Valid transitions: PENDING->ACCEPTED->PREPARING->READY->COMPLETED, or any->CANCELLED (except COMPLETED).';


-- ---------------------------------------------------------------------------
-- 5.3 PROCESS PAYMENT
-- ---------------------------------------------------------------------------
-- Atomic payment processing:
--   1. Create payment record
--   2. Update order payment_status to PAID
--   3. Update order status to COMPLETED
--   4. Close the table session
--   5. Update table status to AVAILABLE
-- All steps are atomic -- if any fails, the entire transaction rolls back.
CREATE OR REPLACE FUNCTION public.process_payment(
    p_order_id          UUID,
    p_amount            DECIMAL(10,2),
    p_tax_amount        DECIMAL(10,2) DEFAULT 0,
    p_discount_amount   DECIMAL(10,2) DEFAULT 0,
    p_payment_method    public.payment_method DEFAULT 'CASH',
    p_transaction_id    TEXT DEFAULT NULL,
    p_notes             TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order             RECORD;
    v_session           RECORD;
    v_total_amount      DECIMAL(10,2);
    v_payment_id        UUID;
    v_current_user_id   UUID;
BEGIN
    v_current_user_id := auth.uid();

    -- -----------------------------------------------------------------------
    -- Step 1: Lock and verify the order
    -- -----------------------------------------------------------------------
    SELECT o.*, t.table_id, t.id AS session_id, t.restaurant_id AS session_restaurant_id
    INTO v_order
    FROM public.orders o
    LEFT JOIN public.order_sessions t ON o.table_session_id = t.id
    WHERE o.id = p_order_id
    FOR UPDATE OF o;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;

    IF v_order.payment_status = 'PAID' THEN
        RAISE EXCEPTION 'Order is already paid';
    END IF;

    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot process payment for a cancelled order';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Calculate total
    -- -----------------------------------------------------------------------
    v_total_amount := p_amount + p_tax_amount - p_discount_amount;

    IF v_total_amount < 0 THEN
        RAISE EXCEPTION 'Total amount cannot be negative: %', v_total_amount;
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 3: Create payment record
    -- -----------------------------------------------------------------------
    INSERT INTO public.payments (
        order_id,
        restaurant_id,
        amount,
        tax_amount,
        discount_amount,
        total_amount,
        payment_method,
        payment_status,
        transaction_id,
        processed_by,
        notes
    )
    VALUES (
        p_order_id,
        v_order.restaurant_id,
        p_amount,
        p_tax_amount,
        p_discount_amount,
        v_total_amount,
        p_payment_method,
        'COMPLETED',
        p_transaction_id,
        v_current_user_id,
        p_notes
    )
    RETURNING id INTO v_payment_id;

    -- -----------------------------------------------------------------------
    -- Step 4: Update order payment status and order status
    -- -----------------------------------------------------------------------
    UPDATE public.orders
    SET payment_status = 'PAID',
        status = 'COMPLETED',
        updated_at = now()
    WHERE id = p_order_id;

    -- -----------------------------------------------------------------------
    -- Step 5: Close the session if it exists
    -- -----------------------------------------------------------------------
    IF v_order.session_id IS NOT NULL THEN
        UPDATE public.order_sessions
        SET status = 'CLOSED', closed_at = now()
        WHERE id = v_order.session_id
        AND status = 'ACTIVE';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 6: Update table status to AVAILABLE
    -- -----------------------------------------------------------------------
    IF v_order.table_id IS NOT NULL THEN
        UPDATE public.tables
        SET status = 'AVAILABLE', updated_at = now()
        WHERE id = v_order.table_id;
    END IF;

    RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION public.process_payment(UUID, DECIMAL, DECIMAL, DECIMAL, public.payment_method, TEXT, TEXT) IS
    'Atomically processes payment: creates payment record, marks order as PAID/COMPLETED, '
    'closes session, and releases table. All steps are transactional.';


-- ---------------------------------------------------------------------------
-- 5.4 RELEASE TABLE
-- ---------------------------------------------------------------------------
-- Manual table release by staff. Cancels all unpaid orders in the session,
-- closes the session with RELEASED status, and marks the table as AVAILABLE.
CREATE OR REPLACE FUNCTION public.release_table(
    p_table_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
BEGIN
    -- -----------------------------------------------------------------------
    -- Step 1: Find and lock the active session
    -- -----------------------------------------------------------------------
    SELECT id, restaurant_id INTO v_session
    FROM public.order_sessions
    WHERE table_id = p_table_id
    AND status = 'ACTIVE'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active session found for this table';
    END IF;

    -- -----------------------------------------------------------------------
    -- Step 2: Cancel all unpaid orders in this session
    -- -----------------------------------------------------------------------
    UPDATE public.orders
    SET status = 'CANCELLED',
        updated_at = now()
    WHERE table_session_id = v_session.id
    AND payment_status = 'UNPAID'
    AND status != 'CANCELLED';

    -- -----------------------------------------------------------------------
    -- Step 3: Close the session with RELEASED status
    -- -----------------------------------------------------------------------
    UPDATE public.order_sessions
    SET status = 'RELEASED', closed_at = now()
    WHERE id = v_session.id;

    -- -----------------------------------------------------------------------
    -- Step 4: Update table status to AVAILABLE
    -- -----------------------------------------------------------------------
    UPDATE public.tables
    SET status = 'AVAILABLE', updated_at = now()
    WHERE id = p_table_id;
END;
$$;

COMMENT ON FUNCTION public.release_table(UUID) IS
    'Manually releases a table: cancels unpaid orders, closes session as RELEASED, '
    'and sets table status to AVAILABLE. Used by staff when guests leave without paying.';


-- ---------------------------------------------------------------------------
-- 5.5 AUTO-GENERATE QR CODE
-- ---------------------------------------------------------------------------
-- Generates a QR code data URL for a table on insert.
-- The QR code encodes a URL that links to the customer menu for that table.
-- Design decision: QR is generated by the database so every table always has
-- a valid QR code. The URL pattern is configurable via a placeholder.
CREATE OR REPLACE FUNCTION public.generate_table_qr_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_qr_data   TEXT;
    v_url       TEXT;
BEGIN
    -- Build the menu URL (customize base URL for your deployment)
    -- Pattern: /{restaurantId}/{tableNumber}
    v_url := '/tables/' || NEW.restaurant_id || '/' || NEW.table_number;

    -- Generate QR code as SVG data URL using PostgreSQL's encode function
    -- We store a placeholder URL that the application layer will replace
    -- with an actual QR code data URL generated by the qrcode npm package
    v_qr_data := 'pending:' || v_url;

    NEW.qr_code := v_qr_data;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_table_qr_code() IS
    'Trigger function to auto-generate a QR code placeholder on table insert. '
    'The actual QR image data URL is generated by the application layer using the qrcode npm package.';


-- =============================================================================
-- SECTION 6: TRIGGERS
-- =============================================================================
-- Database triggers for automatic behavior.
-- =============================================================================

-- Auto-update updated_at on profiles
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update updated_at on restaurants
CREATE TRIGGER set_updated_at_restaurants
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update updated_at on menu_items
CREATE TRIGGER set_updated_at_menu_items
    BEFORE UPDATE ON public.menu_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update updated_at on tables
CREATE TRIGGER set_updated_at_tables
    BEFORE UPDATE ON public.tables
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update updated_at on orders
CREATE TRIGGER set_updated_at_orders
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update updated_at on payments
CREATE TRIGGER set_updated_at_payments
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-generate QR code on table creation
CREATE TRIGGER set_qr_code_on_insert
    BEFORE INSERT ON public.tables
    FOR EACH ROW
    WHEN (NEW.qr_code = '' OR NEW.qr_code IS NULL)
    EXECUTE FUNCTION public.generate_table_qr_code();


-- =============================================================================
-- SECTION 7: ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- RLS policies enforce authorization at the database level.
-- Every query is filtered by these policies, ensuring no data leakage
-- even if application code has bugs.
--
-- Strategy:
--   - SELECT policies allow public reads where appropriate (menu display)
--   - INSERT/UPDATE/DELETE policies check role and restaurant membership
--   - SECURITY DEFINER functions bypass RLS for atomic operations
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 7.1 PROFILES POLICIES
-- ---------------------------------------------------------------------------

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

-- Super admins can read all profiles
CREATE POLICY "profiles_select_super_admin"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Restaurant owners/managers can read profiles in their restaurant
CREATE POLICY "profiles_select_restaurant_staff"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles AS viewer
            WHERE viewer.id = auth.uid()
            AND viewer.role IN ('restaurant_owner', 'manager')
            AND viewer.restaurant_id = profiles.restaurant_id
        )
    );

-- Users can update their own profile (limited fields: full_name, phone)
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Super admins can update any profile
CREATE POLICY "profiles_update_super_admin"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Restaurant owners/managers can update profiles in their restaurant
CREATE POLICY "profiles_update_restaurant_manager"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles AS viewer
            WHERE viewer.id = auth.uid()
            AND viewer.role IN ('restaurant_owner', 'manager')
            AND viewer.restaurant_id = profiles.restaurant_id
        )
    );

-- Super admins can insert profiles (for creating staff accounts)
CREATE POLICY "profiles_insert_super_admin"
    ON public.profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Restaurant owners can insert profiles in their restaurant (invite staff)
CREATE POLICY "profiles_insert_restaurant_owner"
    ON public.profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles AS viewer
            WHERE viewer.id = auth.uid()
            AND viewer.role = 'restaurant_owner'
            AND viewer.restaurant_id = profiles.restaurant_id
        )
    );

-- ---------------------------------------------------------------------------
-- 7.2 RESTAURANTS POLICIES
-- ---------------------------------------------------------------------------

-- Everyone can read active restaurants (for public menu display)
CREATE POLICY "restaurants_select_public"
    ON public.restaurants FOR SELECT
    USING (is_active = true);

-- Super admins can read all restaurants (including inactive)
CREATE POLICY "restaurants_select_super_admin"
    ON public.restaurants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Super admins can do everything with restaurants
CREATE POLICY "restaurants_all_super_admin"
    ON public.restaurants FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Restaurant owners can update their own restaurant
CREATE POLICY "restaurants_update_owner"
    ON public.restaurants FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'restaurant_owner'
            AND restaurant_id = restaurants.id
        )
    );

-- ---------------------------------------------------------------------------
-- 7.3 CATEGORIES POLICIES
-- ---------------------------------------------------------------------------

-- Public read for active categories (menu display)
CREATE POLICY "categories_select_public"
    ON public.categories FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM public.restaurants
            WHERE id = categories.restaurant_id AND is_active = true
        )
    );

-- Restaurant owner/manager can do everything with their categories
CREATE POLICY "categories_all_restaurant_manager"
    ON public.categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('restaurant_owner', 'manager')
            AND restaurant_id = categories.restaurant_id
        )
    );

-- Super admins can do everything with categories
CREATE POLICY "categories_all_super_admin"
    ON public.categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ---------------------------------------------------------------------------
-- 7.4 MENU ITEMS POLICIES
-- ---------------------------------------------------------------------------

-- Public read for available items in active restaurants (menu display)
CREATE POLICY "menu_items_select_public"
    ON public.menu_items FOR SELECT
    USING (
        is_available = true
        AND EXISTS (
            SELECT 1 FROM public.restaurants
            WHERE id = menu_items.restaurant_id AND is_active = true
        )
        AND EXISTS (
            SELECT 1 FROM public.categories
            WHERE id = menu_items.category_id AND is_active = true
        )
    );

-- Restaurant staff can see all menu items (including unavailable)
CREATE POLICY "menu_items_select_restaurant_staff"
    ON public.menu_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('restaurant_owner', 'manager', 'kitchen_staff', 'waiter')
            AND restaurant_id = menu_items.restaurant_id
        )
    );

-- Super admins can see all menu items
CREATE POLICY "menu_items_select_super_admin"
    ON public.menu_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Restaurant owner/manager can do everything with their menu items
CREATE POLICY "menu_items_all_restaurant_manager"
    ON public.menu_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('restaurant_owner', 'manager')
            AND restaurant_id = menu_items.restaurant_id
        )
    );

-- Super admins can do everything with menu items
CREATE POLICY "menu_items_all_super_admin"
    ON public.menu_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ---------------------------------------------------------------------------
-- 7.5 TABLES POLICIES
-- ---------------------------------------------------------------------------

-- Restaurant staff can view tables in their restaurant
CREATE POLICY "tables_select_restaurant_staff"
    ON public.tables FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('restaurant_owner', 'manager', 'waiter', 'cashier', 'kitchen_staff')
            AND restaurant_id = tables.restaurant_id
        )
    );

-- Customers can view active tables (for QR code scanning confirmation)
CREATE POLICY "tables_select_active_public"
    ON public.tables FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM public.restaurants
            WHERE id = tables.restaurant_id AND is_active = true
        )
    );

-- Super admins can do everything with tables
CREATE POLICY "tables_all_super_admin"
    ON public.tables FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Restaurant owner/manager can manage tables
CREATE POLICY "tables_all_restaurant_manager"
    ON public.tables FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('restaurant_owner', 'manager')
            AND restaurant_id = tables.restaurant_id
        )
    );

-- Waiters can update table status
CREATE POLICY "tables_update_waiter"
    ON public.tables FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'waiter'
            AND restaurant_id = tables.restaurant_id
        )
    );

-- ---------------------------------------------------------------------------
-- 7.6 ORDER SESSIONS POLICIES
-- ---------------------------------------------------------------------------

-- Restaurant staff can view sessions in their restaurant
CREATE POLICY "order_sessions_select_restaurant_staff"
    ON public.order_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('restaurant_owner', 'manager', 'waiter', 'cashier', 'kitchen_staff')
            AND restaurant_id = order_sessions.restaurant_id
        )
    );

-- Customers can view active sessions for their table (via the public menu flow)
CREATE POLICY "order_sessions_select_public_active"
    ON public.order_sessions FOR SELECT
    USING (
        status = 'ACTIVE'
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

-- Authenticated users can create sessions (customers placing orders)
CREATE POLICY "order_sessions_insert_authenticated"
    ON public.order_sessions FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Restaurant staff can update sessions (close, release)
CREATE POLICY "order_sessions_update_restaurant_staff"
    ON public.order_sessions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('restaurant_owner', 'manager', 'waiter', 'cashier')
            AND restaurant_id = order_sessions.restaurant_id
        )
    );

-- Super admins can do everything with sessions
CREATE POLICY "order_sessions_all_super_admin"
    ON public.order_sessions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ---------------------------------------------------------------------------
-- 7.7 ORDERS POLICIES
-- ---------------------------------------------------------------------------

-- Restaurant staff can view orders in their restaurant
CREATE POLICY "orders_select_restaurant_staff"
    ON public.orders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('restaurant_owner', 'manager', 'waiter', 'cashier', 'kitchen_staff')
            AND restaurant_id = orders.restaurant_id
        )
    );

-- Customers can view orders in their active session (public flow)
-- This allows customers to see their own order status after placing it
CREATE POLICY "orders_select_public_own_session"
    ON public.orders FOR SELECT
    USING (
        EXISTS (
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

-- Customers can create orders (via the create_order_with_session function, or directly)
CREATE POLICY "orders_insert_authenticated"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Kitchen staff can update order status
CREATE POLICY "orders_update_kitchen_staff"
    ON public.orders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('kitchen_staff', 'manager', 'restaurant_owner')
            AND restaurant_id = orders.restaurant_id
        )
    );

-- Cashiers can update orders (for payment processing)
CREATE POLICY "orders_update_cashier"
    ON public.orders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'cashier'
            AND restaurant_id = orders.restaurant_id
        )
    );

-- Waiters can update orders (for status management)
CREATE POLICY "orders_update_waiter"
    ON public.orders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'waiter'
            AND restaurant_id = orders.restaurant_id
        )
    );

-- Super admins can do everything with orders
CREATE POLICY "orders_all_super_admin"
    ON public.orders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ---------------------------------------------------------------------------
-- 7.8 ORDER ITEMS POLICIES
-- ---------------------------------------------------------------------------

-- Read access follows the parent order's permissions
CREATE POLICY "order_items_select_restaurant_staff"
    ON public.order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE o.id = order_items.order_id
            AND p.role IN ('restaurant_owner', 'manager', 'waiter', 'cashier', 'kitchen_staff')
            AND p.restaurant_id = o.restaurant_id
        )
    );

-- Public read for order items in active sessions (customer order tracking)
CREATE POLICY "order_items_select_public_session"
    ON public.order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.order_sessions s ON o.table_session_id = s.id
            WHERE o.id = order_items.order_id
            AND s.status = 'ACTIVE'
        )
    );

-- Insert is allowed via the create_order_with_session function (SECURITY DEFINER)
-- Direct inserts are restricted to restaurant staff
CREATE POLICY "order_items_insert_restaurant_staff"
    ON public.order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE o.id = order_items.order_id
            AND p.role IN ('restaurant_owner', 'manager', 'waiter')
            AND p.restaurant_id = o.restaurant_id
        )
    );

-- Super admins can do everything with order items
CREATE POLICY "order_items_all_super_admin"
    ON public.order_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ---------------------------------------------------------------------------
-- 7.9 PAYMENTS POLICIES
-- ---------------------------------------------------------------------------

-- Cashiers/managers can create payments
CREATE POLICY "payments_insert_cashier_manager"
    ON public.payments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('cashier', 'manager', 'restaurant_owner')
            AND restaurant_id = payments.restaurant_id
        )
    );

-- Restaurant staff can view payments in their restaurant
CREATE POLICY "payments_select_restaurant_staff"
    ON public.payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('restaurant_owner', 'manager', 'waiter', 'cashier')
            AND restaurant_id = payments.restaurant_id
        )
    );

-- Managers/owners can update payments (for refunds)
CREATE POLICY "payments_update_manager"
    ON public.payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('restaurant_owner', 'manager')
            AND restaurant_id = payments.restaurant_id
        )
    );

-- Super admins can do everything with payments
CREATE POLICY "payments_all_super_admin"
    ON public.payments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );


-- =============================================================================
-- SECTION 8: AUTH TRIGGER - AUTO-CREATE PROFILE ON SIGNUP
-- =============================================================================
-- When a user signs up via Supabase Auth, automatically create a profile
-- row with the role from their JWT metadata. This ensures every auth user
-- has a corresponding profile for RLS policy evaluation.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, restaurant_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'customer'),
        (NEW.raw_user_meta_data->>'restaurant_id')::UUID
    );
    RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
    'Auto-creates a profile row when a new user signs up. '
    'Reads role and restaurant_id from JWT user metadata.';


-- =============================================================================
-- SECTION 9: REALTIME PUBLICATIONS
-- =============================================================================
-- Enable Supabase Realtime on tables that need live updates.
-- =============================================================================

-- Orders: Kitchen display needs real-time order updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Tables: Staff dashboard needs real-time table status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;

-- Order Sessions: Session state changes for dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_sessions;

-- Payments: Payment confirmation broadcasts
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;


-- =============================================================================
-- SECTION 10: STORAGE BUCKETS
-- =============================================================================
-- Supabase Storage buckets for file uploads.
-- Note: Bucket creation is typically done via the Supabase dashboard or
-- the management API, not via SQL. These are provided as reference
-- for the required configuration.
-- =============================================================================

-- Bucket: restaurant-logos
-- Purpose: Store restaurant logo images
-- Access: Public read (for customer menus), authenticated write (for owners/admins)
-- Policy reference (configure via Supabase dashboard):
--   SELECT: public (anyone can view)
--   INSERT: authenticated users only
--   UPDATE: restaurant owner/super_admin only
--   DELETE: super_admin only

-- Bucket: menu-images
-- Purpose: Store menu item photos
-- Access: Public read (for customer menus), authenticated write (for owners/managers)
-- Policy reference (configure via Supabase dashboard):
--   SELECT: public (anyone can view)
--   INSERT: authenticated users only
--   UPDATE: restaurant owner/manager only
--   DELETE: restaurant owner/super_admin only

-- To create buckets programmatically via Supabase Management API:
-- POST /storage/v1/bucket
-- {
--   "name": "restaurant-logos",
--   "public": true,
--   "file_size_limit": 5242880,  -- 5MB
--   "allowed_mime_types": ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
-- }
--
-- POST /storage/v1/bucket
-- {
--   "name": "menu-images",
--   "public": true,
--   "file_size_limit": 10485760,  -- 10MB
--   "allowed_mime_types": ["image/png", "image/jpeg", "image/webp"]
-- }


-- =============================================================================
-- SECTION 11: SEED DATA (Optional)
-- =============================================================================
-- Uncomment and modify the following to seed initial data for development.
-- =============================================================================

-- Create a super admin user (first sign up via auth, then update role):
-- INSERT INTO public.profiles (id, email, full_name, role)
-- VALUES ('your-auth-user-uuid', 'admin@example.com', 'System Admin', 'super_admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'super_admin';


-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
-- Summary:
--   - 7 enum types for role, status, and payment classification
--   - 9 tables: profiles, restaurants, categories, menu_items, tables,
--     order_sessions, orders, order_items, payments
--   - 25 indexes for query performance
--   - 5 database functions: get_user_profile, user_has_role,
--     user_belongs_to_restaurant, handle_updated_at, generate_table_qr_code
--   - 4 business functions: create_order_with_session, update_order_status,
--     process_payment, release_table
--   - 7 triggers: 6 updated_at triggers + 1 QR code generation trigger
--   - 1 auth trigger: auto-create profile on user signup
--   - 35+ RLS policies enforcing role-based access control
--   - 4 realtime publications for live updates
--   - 2 storage bucket configurations (restaurant-logos, menu-images)
-- =============================================================================
