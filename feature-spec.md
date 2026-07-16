# Feature Specification

## Restaurant QR Order System

A complete QR-based ordering platform where customers scan a table QR code, browse the menu, place orders, and pay — all from their phone. Staff manage orders through dedicated dashboards with real-time updates.

---

## User Roles

| Role               | Access Scope                                  |
| ------------------ | --------------------------------------------- |
| Super Admin        | All restaurants, full system management       |
| Restaurant Owner   | Own restaurant settings, menu, staff, reports |
| Manager            | Orders, staff scheduling, reports             |
| Kitchen Staff      | Kitchen display, order status updates         |
| Waiter/Staff       | Table management, order assistance            |
| Cashier            | Payment processing, bill confirmation         |
| Customer (Guest)   | Menu browsing, order placement, bill request  |

---

## Features

### 1. QR Code Management

**Priority:** Core
**Roles:** Super Admin, Restaurant Owner, Manager

| Sub-feature                  | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| Generate QR per table        | Each table gets a unique QR code encoding its table ID and restaurant |
| QR as data URL               | QR codes stored as data URLs — no external image hosting needed       |
| Download QR codes            | Export individual or batch QR codes as PNG for printing               |
| Regenerate QR codes          | Reset all QR codes for a restaurant (e.g., after security concern)    |
| Admin QR management UI       | View, download, and regenerate QR codes from the restaurant dashboard |

**User Flow:**
1. Owner/Manager navigates to Table Management
2. System auto-generates QR codes for all tables on creation
3. User clicks "Download QR" on individual tables or "Download All"
4. QR code opens customer menu at `/{restaurantId}/{tableNumber}`

---

### 2. Digital Menu

**Priority:** Core
**Roles:** Customer (Guest)

| Sub-feature                | Description                                                           |
| -------------------------- | --------------------------------------------------------------------- |
| Category browsing          | Menu organized by categories with item counts                         |
| Item display               | Name, description, price, image, and availability status              |
| Availability filtering     | Unavailable items shown as disabled/greyed out                        |
| Restaurant branding        | Logo and restaurant name displayed at the top of the menu             |
| Responsive mobile-first    | Optimized for phone screens (primary customer device)                 |

**API Endpoint:** `GET /api/menu/{restaurantId}`

**Response Structure:**
```json
{
  "restaurant": { "id", "name", "logo_url" },
  "categories": [
    {
      "id", "name", "sort_order",
      "items": [
        { "id", "name", "description", "price", "image_url", "is_available" }
      ]
    }
  ]
}
```

---

### 3. Order Management

**Priority:** Core
**Roles:** Customer, Kitchen Staff, Manager, Waiter

| Sub-feature                  | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| Create order from phone      | Customers select items, quantities, add notes, and submit             |
| Order sent to kitchen        | New orders appear instantly on kitchen dashboard via Realtime         |
| Special instructions         | Per-item notes (e.g., "no onions", "extra spicy")                    |
| Order status tracking        | Customers see status updates in real-time                             |
| Order history per session    | View all orders placed during a table session                         |

**Order Status Flow:**
```
PENDING → ACCEPTED → PREPARING → READY → COMPLETED
                ↓
            CANCELLED
```

**API Endpoints:**
- `POST /api/orders` — Create new order
- `GET /api/orders/{orderId}` — Get order details
- `GET /api/orders?table_session_id={id}` — Get orders for session

---

### 4. Kitchen Management

**Priority:** Core
**Roles:** Kitchen Staff

| Sub-feature                  | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| Incoming orders queue        | Real-time feed of new orders with item details                        |
| Item details                 | Item name, quantity, special instructions per item                    |
| Status update controls       | Accept, start preparing, mark ready buttons                           |
| Order grouping               | Orders grouped by table for efficient preparation                     |
| Visual priority indicators   | New orders highlighted, older orders de-emphasized                    |

**Realtime Subscription:** `orders` table filtered by `restaurant_id` and status changes.

**User Flow:**
1. Kitchen display shows new orders at top with highlight
2. Kitchen staff clicks "Accept" → status changes to ACCEPTED
3. Staff clicks "Preparing" → status changes to PREPARING
4. Staff clicks "Ready" → status changes to READY, alert sent to staff

---

### 5. Staff Dashboard

**Priority:** Core
**Roles:** Manager, Waiter, Staff

| Sub-feature                  | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| Table status overview        | Grid/list view of all tables with current status                      |
| Active orders tab            | Orders currently being prepared                                       |
| Waiting payment tab          | Orders ready for payment processing                                   |
| Completed orders tab         | Today's completed orders for reference                                |
| Table status management      | Update table: Available, Occupied, Cleaning                           |
| Real-time updates            | All views update via Supabase Realtime subscriptions                  |

**Table Status Flow:**
```
AVAILABLE → OCCUPIED → WAITING_PAYMENT → AVAILABLE
                ↓              ↓
            CLEANING      (after payment)
```

**User Flow:**
1. Waiter sees table status on dashboard
2. When customer scans QR and orders, table auto-changes to OCCUPIED
3. After order is READY, staff delivers and marks table as WAITING_PAYMENT when bill requested
4. After payment, table goes to AVAILABLE (or CLEANING if needed)

---

### 6. Payment Module

**Priority:** Core
**Roles:** Cashier, Manager

| Sub-feature                  | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| Multiple payment methods     | Cash, Card, Digital Wallet                                            |
| Bill calculation             | Subtotal, tax calculation, discount application, grand total          |
| Payment record creation      | Transaction ID, method, amount, timestamp, cashier ID                 |
| Order payment status update  | Orders marked as PAID after successful payment                        |
| Refund processing            | Reverse payments with reason and refund status                        |
| Receipt generation           | Summary of items, subtotal, tax, discounts, payment method            |

**API Endpoints:**
- `POST /api/payments` — Process payment
- `POST /api/payments/{id}/refund` — Process refund
- `GET /api/payments?order_id={id}` — Get payment for order

**Payment Flow:**
1. Customer requests bill (or staff initiates)
2. Cashier views order summary with tax and discounts
3. Customer selects payment method
4. Cashier confirms payment → payment record created
5. Order status auto-updates to COMPLETED
6. Table session closed, table released

---

### 7. Table Session Management

**Priority:** Core
**Roles:** System (automatic)

| Sub-feature                  | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| Auto-create session          | Session created when first order placed for a table                   |
| Atomic session locking       | Prevents race conditions with concurrent order attempts               |
| Duplicate order prevention   | Block new orders if unpaid session exists                             |
| Session auto-close           | Close session after payment is processed                              |
| Manual table release         | Staff can release table, cancelling any unpaid orders                 |
| Order locking                | No new orders allowed until current session payment completes         |

**Session States:**
```
ACTIVE (unpaid orders exist) → CLOSED (payment completed)
                                ↓
                            RELEASED (staff manually released)
```

**User Flow:**
1. Customer scans QR → system checks for existing active session
2. If no session → create session, allow ordering
3. If active session with unpaid orders → block new orders, show "Please pay current bill"
4. After payment → session closed, table available for new session

---

### 8. Restaurant Management (Super Admin)

**Priority:** High
**Roles:** Super Admin

| Sub-feature                  | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| Create restaurant            | Name, contact info, settings                                         |
| Edit restaurant              | Update details, branding                                              |
| Delete restaurant            | Soft delete (deactivate) or hard delete                               |
| Logo upload                  | Upload and manage restaurant logo via Supabase Storage                |
| Activate/deactivate          | Toggle restaurant active status (hides from public)                   |
| Restaurant list              | View all restaurants with stats                                       |

**API Endpoints:**
- `POST /api/restaurants` — Create restaurant
- `PUT /api/restaurants/{id}` — Update restaurant
- `DELETE /api/restaurants/{id}` — Delete restaurant
- `PUT /api/restaurants/{id}/logo` — Upload logo
- `GET /api/restaurants` — List all restaurants

---

### 9. Restaurant Owner Features

**Priority:** High
**Roles:** Restaurant Owner

| Sub-feature                  | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| Menu management              | CRUD operations for categories and menu items                         |
| Category ordering            | Drag-and-drop or manual sort order for categories                     |
| Menu item images             | Upload images for menu items                                          |
| Item availability toggle     | Quickly mark items as available/unavailable                           |
| Table management             | Add, edit, remove tables                                              |
| Staff management             | Invite staff, assign roles, deactivate accounts                       |
| Business hours               | Set operating hours per day                                           |
| Reports                      | Daily/weekly/monthly sales reports, popular items, peak hours         |

---

### 10. Branding & White Label

**Priority:** Medium
**Roles:** Restaurant Owner, Super Admin

| Sub-feature                  | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| Restaurant logo on menu      | Logo displayed prominently on customer menu                           |
| Restaurant name header       | Name shown in menu header and browser tab                             |
| Custom color theme           | Optional: brand colors for customer-facing menu                       |
| Print-ready QR codes         | QR codes with restaurant branding for table tents                     |

---

### 11. Role & Permission Management

**Priority:** Core (Cross-cutting)
**Roles:** Super Admin, Restaurant Owner, Manager

#### Role Hierarchy

```
Super Admin
  └── Restaurant Owner
        ├── Manager
        │     ├── Kitchen Staff
        │     ├── Waiter
        │     └── Cashier
        └── Customer (Guest, no assignment needed)
```

#### Role Definitions

| Role               | Scope                        | Description                                                           |
| ------------------ | ---------------------------- | --------------------------------------------------------------------- |
| `super_admin`      | System-wide                  | Full access across all restaurants. Can create/delete restaurants, manage all users, override any restriction. |
| `restaurant_owner` | Own restaurant               | Full control over own restaurant: menu, tables, staff, settings, reports. Cannot access other restaurants. |
| `manager`          | Own restaurant               | Manage orders, staff scheduling, daily operations. Cannot delete restaurant or manage owner-level settings. |
| `kitchen_staff`    | Own restaurant (kitchen)     | View incoming orders, update order status (ACCEPTED → PREPARING → READY). Cannot access payments or staff management. |
| `waiter`           | Own restaurant (floor)       | View table status, assist customers, update table status. Cannot process payments or modify menu. |
| `cashier`          | Own restaurant (payments)    | Process payments, view bills, issue refunds. Cannot modify menu or update order status. |
| `customer`         | Public (menu + ordering)     | Browse menu, place orders, view own order status, request bill. No access to staff dashboards. |

#### Permission Matrix

| Resource              | Super Admin       | Owner             | Manager           | Kitchen           | Waiter            | Cashier           | Customer          |
| --------------------- | ----------------- | ----------------- | ----------------- | ----------------- | ----------------- | ----------------- | ----------------- |
| **Restaurants**       |                   |                   |                   |                   |                   |                   |                   |
| Create restaurant     | ✅                | ❌                | ❌                | ❌                | ❌                | ❌                | ❌                |
| Edit restaurant       | ✅ (any)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                | ❌                |
| Delete restaurant     | ✅ (any)          | ❌                | ❌                | ❌                | ❌                | ❌                | ❌                |
| View restaurant       | ✅ (all)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (active only)  |
| **Menu**              |                   |                   |                   |                   |                   |                   |                   |
| View menu             | ✅ (any)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (available)    |
| Create/edit category  | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                |
| Delete category       | ✅ (any)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                | ❌                |
| Create/edit menu item | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                |
| Delete menu item      | ✅ (any)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                | ❌                |
| Toggle availability   | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                |
| Upload item image     | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                |
| **Tables**            |                   |                   |                   |                   |                   |                   |                   |
| View tables           | ✅ (any)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ❌                |
| Create/edit table     | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                |
| Delete table          | ✅ (any)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                | ❌                |
| Update table status   | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ✅ (own)          | ❌                | ❌                |
| Download QR codes     | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                |
| **Orders**            |                   |                   |                   |                   |                   |                   |                   |
| View orders           | ✅ (any)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ✅ (own session)  |
| Create order          | ✅                | ❌                | ❌                | ❌                | ❌                | ❌                | ✅                |
| Update order status   | ✅ (any)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                |
| Cancel order          | ✅ (any)          | ✅ (own)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                |
| **Payments**          |                   |                   |                   |                   |                   |                   |                   |
| Process payment       | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ✅ (own)          | ❌                |
| View payments         | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ✅ (own)          | ✅ (own)          | ❌                |
| Issue refund          | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ✅ (own)          | ❌                |
| **Staff**             |                   |                   |                   |                   |                   |                   |                   |
| View staff list       | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                |
| Invite staff          | ✅ (any)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                | ❌                |
| Change staff role     | ✅ (any)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                | ❌                |
| Deactivate staff      | ✅ (any)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                | ❌                |
| **Reports**           |                   |                   |                   |                   |                   |                   |                   |
| View sales reports    | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                |
| View popular items    | ✅ (any)          | ✅ (own)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                |
| Export reports        | ✅ (any)          | ✅ (own)          | ❌                | ❌                | ❌                | ❌                | ❌                |

#### Role Assignment Flow

**Super Admin creates Restaurant:**
1. Super Admin creates restaurant → restaurant record created
2. Super Admin invites Owner → auth user created with `role: restaurant_owner`, `restaurant_id` set
3. Owner logs in → sees their restaurant dashboard

**Owner/Manager invites Staff:**
1. Owner/Manager enters staff email + role
2. System sends invite email (Supabase Auth)
3. Staff clicks link → signs up → profile auto-created via `handle_new_user()` trigger
4. Profile assigned to restaurant with correct role

**Customer (No Assignment):**
1. Customer scans QR code → redirected to public menu
2. System creates anonymous session or uses magic link
3. No profile required for ordering (optional name field)

#### RLS Policy Summary

| Table             | Public Read            | Staff Read           | Staff Write          | Admin Override       |
| ----------------- | ---------------------- | -------------------- | -------------------- | -------------------- |
| `restaurants`     | Active only            | Own restaurant       | Owner (update)       | Super Admin (all)    |
| `categories`      | Active in active rest. | Own restaurant       | Owner/Manager        | Super Admin (all)    |
| `menu_items`      | Available in active    | Own restaurant       | Owner/Manager        | Super Admin (all)    |
| `tables`          | Active in active rest. | Own restaurant       | Owner/Manager/Waiter | Super Admin (all)    |
| `orders`          | Active session only    | Own restaurant       | Kitchen/Cashier/Waiter | Super Admin (all) |
| `order_items`     | Active session only    | Own restaurant       | Owner/Manager/Waiter | Super Admin (all)    |
| `order_sessions`  | Active only            | Own restaurant       | Owner/Manager/Cashier | Super Admin (all)   |
| `payments`        | ❌                     | Own restaurant       | Cashier/Manager      | Super Admin (all)    |
| `profiles`        | Own only               | Own restaurant       | Owner/Manager        | Super Admin (all)    |

#### Access Control Implementation

**Middleware Layer (Next.js):**
```
middleware.ts
  ├── Check JWT token validity
  ├── Extract role from token metadata
  ├── Redirect based on role:
  │     super_admin    → /super-admin
  │     restaurant_owner → /owner
  │     manager        → /manager
  │     kitchen_staff  → /kitchen
  │     waiter         → /staff
  │     cashier        → /cashier
  │     customer       → /{restaurantId}/{tableNumber}
  └── Block access to unauthorized routes
```

**API Layer (Route Handlers):**
```
api/[...route]/route.ts
  ├── Verify session (Supabase Auth)
  ├── Fetch user profile (role + restaurant_id)
  ├── Check route-level permission
  ├── Apply restaurant scoping (filter by restaurant_id)
  └── Return 403 if unauthorized
```

**Database Layer (RLS):**
```
RLS Policies
  ├── Every query filtered by auth.uid()
  ├── Role checked via user_has_role() function
  ├── Restaurant scope via user_belongs_to_restaurant() function
  └── SECURITY DEFINER functions bypass RLS for atomic operations
```

#### API Endpoints for Role Management

| Endpoint                            | Method | Access                  | Description                     |
| ----------------------------------- | ------ | ----------------------- | ------------------------------- |
| `/api/admin/users`                  | GET    | Super Admin             | List all users across restaurants |
| `/api/admin/users`                  | POST   | Super Admin             | Create user with any role       |
| `/api/admin/users/{id}`             | PUT    | Super Admin             | Update any user                 |
| `/api/admin/users/{id}`             | DELETE | Super Admin             | Deactivate any user             |
| `/api/restaurants/{id}/staff`       | GET    | Owner, Manager          | List staff in restaurant        |
| `/api/restaurants/{id}/staff`       | POST   | Owner                   | Invite staff to restaurant      |
| `/api/restaurants/{id}/staff/{id}`  | PUT    | Owner                   | Update staff role               |
| `/api/restaurants/{id}/staff/{id}`  | DELETE | Owner                   | Deactivate staff                |
| `/api/auth/invite`                  | POST   | Owner, Super Admin      | Send invite email               |
| `/api/auth/accept-invite`           | POST   | Invited user            | Complete registration           |

---

## Cross-Cutting Concerns

### Responsive Design
- Mobile-first for customer menu (primary use case)
- Tablet-optimized for kitchen display
- Desktop-optimized for admin/management dashboards

### Real-time Updates
- All dashboards use Supabase Realtime subscriptions
- Automatic cleanup on component unmount
- Fallback to polling if WebSocket connection fails

### Error Handling
- Toast notifications for user-facing errors
- Graceful degradation for network issues
- Optimistic UI updates with rollback on failure

### Accessibility
- Keyboard navigation support
- Screen reader compatible
- Sufficient color contrast ratios
- Touch targets minimum 44x44px

---

## Definition of Done

### Database & Backend

- [ ] All 9 tables created with correct constraints and foreign keys
- [ ] All 7 enum types defined and enforced
- [ ] All 45 RLS policies active and tested for every role
- [ ] All 8 indexes created for query performance
- [ ] `create_order_with_session()` atomic function working
- [ ] `update_order_status()` enforces valid state transitions only
- [ ] `process_payment()` handles all payment methods atomically
- [ ] `release_table()` cancels unpaid orders and frees table
- [ ] Auto `updated_at` triggers on all tables
- [ ] Auto QR code generation on table creation
- [ ] Auto profile creation on user signup via `handle_new_user()`
- [ ] Realtime publications enabled on `orders`, `tables`, `order_sessions`, `payments`

### Authentication & Authorization

- [ ] Supabase Auth configured with email/password sign-in
- [ ] JWT token includes role and restaurant_id metadata
- [ ] Middleware redirects users to correct dashboard based on role
- [ ] 7 user roles functioning: super_admin, restaurant_owner, manager, kitchen_staff, waiter, cashier, customer
- [ ] Restaurant-scoped data isolation verified (Owner A cannot see Owner B's data)
- [ ] Super Admin bypass working across all tables
- [ ] Customer can access public menu without authentication
- [ ] Staff invite flow working (Owner invites → email sent → account created)

### Feature 1: QR Code Management

- [ ] QR codes auto-generated for each table on creation
- [ ] QR codes encode correct URL pattern (`/{restaurantId}/{tableNumber}`)
- [ ] Individual QR download as PNG working
- [ ] Batch QR download (all tables) working
- [ ] QR regeneration working (new QR replaces old)
- [ ] QR codes resolve to correct customer menu

### Feature 2: Digital Menu

- [ ] Categories displayed in sort order
- [ ] Menu items show name, description, price, image
- [ ] Unavailable items greyed out / disabled
- [ ] Restaurant logo and name displayed at top
- [ ] Mobile-first responsive layout working
- [ ] `GET /api/menu/{restaurantId}` returns correct nested structure

### Feature 3: Order Management

- [ ] Customer can select items, quantities, and add special instructions
- [ ] Order created with correct status (`PENDING`)
- [ ] Order items contain price snapshot (not live menu price)
- [ ] Order appears on kitchen dashboard in real-time
- [ ] Customer can view own order status in real-time
- [ ] `POST /api/orders` validates all items belong to restaurant
- [ ] `POST /api/orders` rejects unavailable items

### Feature 4: Kitchen Management

- [ ] Incoming orders appear instantly via Realtime subscription
- [ ] Order details show item names, quantities, special instructions
- [ ] Status buttons work: Accept → Preparing → Ready
- [ ] Invalid status transitions blocked (e.g., can't skip to READY)
- [ ] Orders grouped by table for efficient preparation
- [ ] Visual indicators for new vs. in-progress orders

### Feature 5: Staff Dashboard

- [ ] Table status grid shows all tables with current status
- [ ] Active orders tab lists orders being prepared
- [ ] Waiting payment tab lists orders ready for payment
- [ ] Completed orders tab shows today's fulfilled orders
- [ ] Table status updates work (Available → Occupied → Waiting Payment → Available)
- [ ] Real-time updates on all dashboard tabs
- [ ] Waiter can update table status

### Feature 6: Payment Module

- [ ] Cash payment processing working
- [ ] Card payment processing working
- [ ] Digital wallet payment processing working
- [ ] Bill calculation: subtotal + tax - discount = total
- [ ] Tax rate pulled from restaurant settings
- [ ] Payment record created with all fields (amount, tax, discount, method, cashier)
- [ ] Order `payment_status` updated to `PAID` after payment
- [ ] Order `status` updated to `COMPLETED` after payment
- [ ] Session closed after payment
- [ ] Table status reset to `AVAILABLE` after payment
- [ ] Refund processing working with reason field

### Feature 7: Table Session Management

- [ ] Session auto-created on first order for a table
- [ ] Only ONE active session per table enforced
- [ ] Concurrent order attempts blocked (atomic locking via `SELECT FOR UPDATE`)
- [ ] New orders blocked when unpaid session exists
- [ ] Session auto-closed after payment
- [ ] Manual table release cancels unpaid orders
- [ ] Table status correctly updated on session state changes

### Feature 8: Restaurant Management (Super Admin)

- [ ] Create restaurant with name, contact info, settings
- [ ] Edit restaurant details
- [ ] Soft delete (deactivate) restaurant
- [ ] Logo upload to Supabase Storage working
- [ ] Activate/deactivate toggle working
- [ ] Restaurant list with stats displayed

### Feature 9: Restaurant Owner Features

- [ ] CRUD operations for categories (create, read, update, delete)
- [ ] CRUD operations for menu items
- [ ] Category sort order management
- [ ] Menu item image upload working
- [ ] Item availability toggle (quick switch)
- [ ] Table management (add, edit, remove tables)
- [ ] Staff management (invite, assign role, deactivate)
- [ ] Sales reports accessible

### Feature 10: Branding & White Label

- [ ] Restaurant logo displayed on customer menu
- [ ] Restaurant name shown in menu header and browser tab
- [ ] QR codes are print-ready quality

### Feature 11: Role & Permission Management

- [ ] Permission matrix enforced at database level (RLS)
- [ ] Permission matrix enforced at API level (route handlers)
- [ ] Permission matrix enforced at UI level (middleware + conditional rendering)
- [ ] Super Admin can manage all restaurants and users
- [ ] Owner can manage own restaurant only
- [ ] Manager can manage orders and staff but not restaurant settings
- [ ] Kitchen staff can only view/update order status
- [ ] Waiter can only view tables and update table status
- [ ] Cashier can only process payments and view payments
- [ ] Customer can only browse menu and place orders
- [ ] Role assignment flow working (invite → signup → role assigned)

### Cross-Cutting

- [ ] Mobile-first responsive design on customer menu
- [ ] Tablet-optimized kitchen display
- [ ] Desktop-optimized admin dashboards
- [ ] Real-time subscriptions with automatic cleanup on unmount
- [ ] Fallback to polling if WebSocket fails
- [ ] Toast notifications for all user-facing errors
- [ ] Graceful network error handling
- [ ] Optimistic UI updates with rollback on failure
- [ ] Keyboard navigation support
- [ ] Screen reader compatible
- [ ] Color contrast meets WCAG AA
- [ ] Touch targets minimum 44x44px on mobile

### Code Quality

- [ ] TypeScript strict mode enabled
- [ ] All API endpoints validated with Zod schemas
- [ ] No console errors in production build
- [ ] ESLint passing with zero warnings
- [ ] Prettier formatting consistent
- [ ] Environment variables documented in `.env.example`
- [ ] README.md with setup instructions

### Testing

- [ ] Unit tests for database functions (create_order, update_status, process_payment)
- [ ] Integration tests for RLS policies (each role tested)
- [ ] E2E tests for customer order flow
- [ ] E2E tests for kitchen order status flow
- [ ] E2E tests for payment processing flow
- [ ] E2E tests for session locking (concurrent order attempts)
- [ ] Load test for real-time subscriptions

### Deployment

- [ ] Supabase migration applied to production
- [ ] Storage buckets created with correct policies
- [ ] Environment variables set in Vercel
- [ ] Custom domain configured (if applicable)
- [ ] SSL/HTTPS enabled
- [ ] Error monitoring configured (Sentry or similar)
