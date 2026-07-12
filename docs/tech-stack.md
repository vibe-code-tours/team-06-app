# Tech Stack

## Overview

Restaurant QR Order System built with a serverless-first architecture using Next.js and Supabase.

---

## Core Stack

| Layer             | Technology               | Purpose                                  |
| ----------------- | ------------------------ | ---------------------------------------- |
| **Frontend**      | Next.js (App Router)     | SSR/CSR hybrid, API routes, file-based routing |
| **Backend**       | Supabase                 | BaaS: Auth, Database, Realtime, Storage  |
| **Database**      | PostgreSQL (Supabase)    | Relational data, RLS policies            |
| **Authentication**| Supabase Auth            | JWT-based sessions, role-based access    |
| **Real-time**     | Supabase Realtime        | WebSocket subscriptions for live updates |
| **Storage**       | Supabase Storage         | Image uploads (logos, menu items)        |
| **QR Generation** | `qrcode` npm package     | Data URL QR codes per table              |

---

## Supabase Services

### Database (PostgreSQL)
- Table management with foreign keys and constraints
- Row Level Security (RLS) policies per role
- Stored procedures for atomic operations (session locking, payment processing)
- Indexes on frequently queried columns (order status, table ID, session state)

### Auth
- Email/password and magic link sign-in
- JWT token with role metadata (`user_metadata.role`)
- 7 predefined roles: `super_admin`, `restaurant_owner`, `manager`, `kitchen_staff`, `waiter`, `cashier`, `customer`
- RLS policies enforce authorization at the database level

### Realtime
- Order status subscriptions (kitchen dashboard)
- New order alerts (staff/waiter dashboard)
- Table status updates (staff dashboard)
- Payment confirmation broadcasts

### Storage
- Buckets for restaurant logos and menu item images
- Public URLs for customer-facing menu
- Signed URLs for admin uploads

---

## Frontend Architecture

### Routing (Next.js App Router)
```
app/
├── (auth)/login/page.tsx              # Login page
├── (super-admin)/super-admin/         # Super Admin dashboard
├── (restaurant-owner)/owner/          # Restaurant Owner dashboard
├── (manager)/manager/                 # Manager dashboard
├── (kitchen)/kitchen/                 # Kitchen display
├── (staff)/staff/                     # Staff/Waiter dashboard
├── (cashier)/cashier/                 # Cashier payment terminal
├── (customer)/[restaurantId]/[tableNumber]/  # Customer menu view
├── api/                               # API route handlers
└── layout.tsx                         # Root layout
```

### Key Frontend Libraries
| Library            | Purpose                              |
| ------------------ | ------------------------------------ |
| `@supabase/supabase-js` | Supabase client (browser/server) |
| `@supabase/ssr`    | Server-side Supabase integration     |
| `qrcode`           | QR code generation (data URLs)       |
| `tailwindcss`      | Utility-first CSS                    |
| `shadcn/ui`        | Pre-built UI components              |
| `react-hook-form`  | Form state management                |
| `zod`              | Schema validation                    |

### Client-Side Architecture
- **Supabase Browser Client**: Singleton pattern for client components
- **Supabase Server Client**: Created per-request in server components and API routes
- **Realtime Subscriptions**: Mounted in dashboard components, cleaned up on unmount
- **Auth Context**: Global auth state via React Context

---

## Database Schema (High-Level)

### Core Tables
| Table              | Purpose                              |
| ------------------ | ------------------------------------ |
| `restaurants`      | Restaurant profiles (name, logo, active status) |
| `categories`       | Menu categories per restaurant       |
| `menu_items`       | Menu items with price, image, availability |
| `tables`           | Physical tables with QR codes        |
| `orders`           | Customer orders with status tracking |
| `order_items`      | Line items within an order           |
| `order_sessions`   | Active table sessions (prevents duplicates) |
| `payments`         | Payment records with method and amount |
| `profiles`         | User profiles with roles             |

### Key Enums
| Enum                  | Values                                                                     |
| --------------------- | -------------------------------------------------------------------------- |
| `user_role`           | `super_admin`, `restaurant_owner`, `manager`, `kitchen_staff`, `waiter`, `cashier`, `customer` |
| `order_status`        | `PENDING`, `ACCEPTED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`      |
| `table_status`        | `AVAILABLE`, `OCCUPIED`, `WAITING_PAYMENT`, `CLEANING`                     |
| `session_status`      | `ACTIVE`, `CLOSED`, `RELEASED`                                             |
| `payment_method`      | `CASH`, `CARD`, `DIGITAL_WALLET`                                           |
| `payment_status`      | `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`                               |
| `order_payment_status`| `UNPAID`, `PAID`                                                           |

---

## Security

### Row Level Security (RLS)
- Enabled on all tables
- Policies enforce role-based access at the database level
- Super Admin: full access across all restaurants
- Restaurant-scoped access for Owner, Manager, Staff, Kitchen, Cashier
- Customer: read-only menu access via public endpoints

### Session Management
- Supabase JWT tokens with short expiry
- Refresh token rotation
- Middleware for route protection
- Role-based redirect after login

---

## Deployment Target

| Service         | Platform          |
| --------------- | ----------------- |
| Frontend        | Vercel            |
| Backend         | Supabase Cloud    |
| Database        | Supabase PostgreSQL |
| Storage         | Supabase Storage  |
| CDN             | Vercel Edge Network |

---

## Development Tools

| Tool              | Purpose                              |
| ----------------- | ------------------------------------ |
| TypeScript        | Type safety across frontend/backend  |
| ESLint            | Code quality enforcement             |
| Prettier          | Code formatting                      |
| Git               | Version control                      |
| Supabase CLI      | Local dev, migrations, seed data     |
| `@supabase/genersupabase-js` | Type generation from schema |
