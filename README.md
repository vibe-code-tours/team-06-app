<div align="center">
  <img src="apps/web/public/logo.png" alt="QR Dine" width="400">
</div>

<h1 align="center">QR Dine — Restaurant QR Order System</h1>

<p align="center">
  A complete QR-based ordering platform where customers scan a table QR code, browse the menu,
  place orders, and pay — all from their phone. Staff manage everything through role-based
  dashboards with real-time updates.
</p>

<p align="center">
  <a href="https://qrdine-demo.vercel.app">
    <img src="https://img.shields.io/badge/Live_Demo-🔗-8B5CF6?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo">
  </a>
  <a href="#-getting-started">
    <img src="https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 14">
  </a>
  <a href="#-tech-stack">
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
  </a>
  <a href="#-tech-stack">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  </a>
  <a href="#-license">
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License">
  </a>
</p>

<br>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🖥️ Screenshots](#️-screenshots)
- [🧑‍💼 User Roles](#-user-roles)
- [🛠️ Tech Stack](#️-tech-stack)
- [📦 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [🧪 Testing](#-testing)
- [📖 Documentation](#-documentation)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

### 📱 Customer Experience

| Feature | Description |
|---------|-------------|
| **Scan & Order** | Customers scan a table QR code and instantly access the digital menu |
| **Digital Menu** | Browse categories, view item details, prices, and images |
| **Custom Orders** | Add special instructions per item (e.g., "no onions", "extra spicy") |
| **Real-Time Tracking** | Follow order status live — from PENDING → ACCEPTED → PREPARING → READY → COMPLETED |

### 👨‍🍳 Kitchen Dashboard

| Feature | Description |
|---------|-------------|
| **Live Order Queue** | New orders appear instantly via Supabase Realtime subscriptions |
| **Status Controls** | Accept, start preparing, and mark orders ready — one click each |
| **Order Grouping** | Orders grouped by table for efficient preparation |
| **Priority Indicators** | New orders highlighted, older orders de-emphasized |
| **Item Details** | See item names, quantities, and special instructions at a glance |

### 🧑‍💼 Staff Dashboard (Waiters)

| Feature | Description |
|---------|-------------|
| **Table Overview** | Grid view of all tables with current status (Available / Occupied / Cleaning) |
| **Active Orders Tab** | Orders currently being prepared |
| **Waiting Payment Tab** | Orders ready for payment processing |
| **Completed Orders Tab** | Today's fulfilled orders for reference |
| **Real-Time Updates** | All views update live via WebSocket |

### 💳 Payment Module

| Feature | Description |
|---------|-------------|
| **Multiple Methods** | Cash, Card, and Digital Wallet supported |
| **Bill Calculation** | Subtotal, tax, discounts, and grand total — fully configurable |
| **Payment Records** | Transaction ID, method, amount, timestamp, and cashier ID |
| **Refund Processing** | Reverse payments with reason and refund status |
| **Receipt Generation** | Itemized summary with subtotal, tax, discounts, and payment method |

### 🛠️ Owner Management & Admin

| Feature | Description |
|---------|-------------|
| **Menu Management** | Full CRUD for categories and items with image upload and availability toggle |
| **Table Management** | Add, edit, remove tables with auto-generated QR codes |
| **Staff Management** | Invite staff, assign roles (7 roles), deactivate accounts |
| **QR Code Management** | Generate, download, and regenerate QR codes per table or batch |
| **Business Settings** | Operating name, email, tax rates, restaurant branding, and more |
| **Multi-Restaurant** | Super Admin can manage all restaurants from a single dashboard |

### 🔒 Security & Permissions

- **Row Level Security (RLS)** on all 9+ tables — no exceptions
- **45+ RLS policies** enforcing fine-grained role-based access
- **Atomic database functions** for order creation, payment processing, and session locking
- **Three-layer authorization**: database (RLS) → API (route handlers) → UI (middleware + conditional rendering)
- **Restaurant-scoped data isolation** — Owner A can never see Owner B's data

---

## 🖥️ Screenshots

### Customer Order Flow

<p align="center">
  <img src="screenshots/CustomerOrder1.png" alt="Menu Overview" width="180">
  <img src="screenshots/CustomerOrder2.png" alt="Menu Categories" width="180">
  <img src="screenshots/CustomerOrder3.png" alt="Item Details" width="180">
  <img src="screenshots/CustomerOrder4.png" alt="Cart Review" width="180">
  <img src="screenshots/CustomerOrder5.png" alt="Order Placed" width="180">
</p>
<p align="center">
  <em>From left to right: Menu overview → Category browsing → Item details → Cart review → Order confirmation</em>
</p>

<p align="center">
  <img src="screenshots/CustomerOrder6.png" alt="Order Status" width="180">
  <img src="screenshots/CustomerOrder7.png" alt="Order Tracking" width="180">
  <img src="screenshots/CustomerOrder8.png" alt="Order Ready" width="180">
  <img src="screenshots/CustomerOrder9.png" alt="Bill Request" width="180">
</p>
<p align="center">
  <em>Order tracking in real-time: Status updates → Preparing → Ready for pickup → Bill request</em>
</p>

### Staff Dashboards

<table>
  <tr>
    <td width="50%" align="center">
      <img src="screenshots/Login.png" alt="Login" width="100%"><br>
      <em>🔐 Authentication — Role-based login redirects users to their dashboard</em>
    </td>
    <td width="50%" align="center">
      <img src="screenshots/Kitchen.png" alt="Kitchen Dashboard" width="100%"><br>
      <em>👨‍🍳 Kitchen Dashboard — Real-time order queue with status controls</em>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="screenshots/Staff.png" alt="Staff Dashboard" width="100%"><br>
      <em>🧑‍💼 Staff Dashboard — Table status overview and order management</em>
    </td>
    <td width="50%" align="center">
      <img src="screenshots/Cashier.png" alt="Cashier Panel" width="100%"><br>
      <em>💳 Cashier Panel — Payment processing with multiple methods</em>
    </td>
  </tr>
</table>

### Manager, Owner Management & Admin

<table>
  <tr>
    <td width="50%" align="center">
      <img src="screenshots/Manager.png" alt="Manager Dashboard" width="100%"><br>
      <em>📊 Manager Dashboard — Oversee orders, staff, and daily operations</em>
    </td>
    <td width="50%" align="center">
      <img src="screenshots/Owner3.png" alt="Owner Dashboard" width="100%"><br>
      <em>🏪 Owner's Staff Management — Full control over restaurant settings and staff roles</em>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="screenshots/Owner1.png" alt="Menu Management" width="100%"><br>
      <em>📋 Owner's Menu Management — CRUD operations for categories and items</em>
    </td>
    <td width="50%" align="center">
      <img src="screenshots/Owner2.png" alt="Table & Staff Management" width="100%"><br>
      <em>🪑 Owner's Table Management — Manage tables and QR codes</em>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="screenshots/SuperAdmin.png" alt="Super Admin Dashboard" width="70%"><br>
      <em>🌐 Super Admin Dashboard — Multi-restaurant management and system-wide control</em>
    </td>
  </tr>
</table>

---

## 🧑‍💼 User Roles

The system defines **7 user roles** with a hierarchical permission model:

```
Super Admin
  └── Restaurant Owner
        ├── Manager
        │     ├── Kitchen Staff
        │     ├── Waiter
        │     └── Cashier
        └── Customer (Guest, no assignment needed)
```

| Role | Scope | Key Permissions |
|------|-------|-----------------|
| **Super Admin** | System-wide | Full access across all restaurants, user management, system settings |
| **Restaurant Owner** | Own restaurant | Menu, tables, staff, settings, reports — full control over own restaurant |
| **Manager** | Own restaurant | Orders, staff scheduling, daily operations (no owner-level settings) |
| **Kitchen Staff** | Kitchen only | View orders, update status (Accept → Preparing → Ready) |
| **Waiter** | Floor only | Table status, order assistance, customer support |
| **Cashier** | Payments only | Process payments, view bills, issue refunds |
| **Customer** | Public | Browse menu, place orders, track status, request bill |

> 📖 See [`feature-spec.md`](feature-spec.md#-role--permission-management) for the complete permission matrix with all 100+ resource-role combinations.

---

## 🛠️ Tech Stack

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 14">
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white" alt="Turborepo">
  <img src="https://img.shields.io/badge/Zod-3068B7?style=for-the-badge&logo=zod&logoColor=white" alt="Zod">
</p>

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | Next.js 15 (App Router) | Full-stack React framework with server components |
| **Language** | TypeScript (strict mode) | Type-safe development across the entire codebase |
| **Database** | Supabase (PostgreSQL) | Relational database with 45+ RLS policies |
| **Auth** | Supabase Auth | Email/password, JWT with role & restaurant metadata |
| **Realtime** | Supabase Realtime | WebSocket subscriptions for live dashboard updates |
| **Storage** | Supabase Storage | Menu item images and restaurant logos |
| **UI** | Tailwind CSS + shadcn/ui | Utility-first CSS with accessible component primitives |
| **Validation** | Zod | Runtime validation for all API inputs and forms |
| **Forms** | react-hook-form | Performant form management |
| **Monorepo** | Turborepo | Shared packages, coordinated builds |

---

## 📦 Project Structure

```
team-06-app/
├── apps/
│   └── web/                     # Next.js frontend (App Router)
│       ├── app/
│       │   ├── (auth)/          # Login and registration
│       │   ├── (super-admin)/   # Multi-restaurant management
│       │   ├── (restaurant-owner)/  # Owner dashboard & settings
│       │   ├── (manager)/       # Manager operations
│       │   ├── (kitchen)/       # Kitchen order queue
│       │   ├── (staff)/         # Waiter table management
│       │   ├── (cashier)/       # Payment processing
│       │   ├── (customer)/      # Public menu & ordering
│       │   └── api/             # Route handlers (REST)
│       └── lib/
│           ├── validators/      # Zod schemas
│           └── services/        # Business logic layer
├── packages/
│   └── shared/                  # Shared types, utils, validators
├── supabase/
│   ├── migrations/              # Database migrations (46+)
│   └── functions/               # Supabase Edge Functions
├── tests/                       # Integration & E2E tests
├── docs/                        # Documentation & workflow plans
└── screenshots/                 # Feature screenshots
```

### Architecture Principles

- **Handlers stay thin** — Route handlers validate input (Zod) and delegate to service functions
- **Services own business logic** — Order state transitions, session locking, payment math in services
- **Atomic DB operations** — `create_order_with_session()`, `update_order_status()`, `process_payment()` use `SELECT FOR UPDATE` transactions
- **Three-layer security** — Every mutation is permission-checked at RLS (DB), API (route handler), and UI (conditional rendering)

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 22+ |
| npm | 10+ |
| Docker Desktop | Required for local Supabase |
| Supabase CLI | Included as dev dependency |

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd team-06-app

# Install dependencies
npm install

# Start Supabase locally (applies all migrations on first boot)
npm run db:start

# Print your local API URL and keys
npx supabase status
```

### Environment Setup

`npm run db:start` prints (or `npx supabase status` re-prints) the local `API URL`,
`anon key`, and `service_role key`. Create your environment files:

```bash
# Next.js app configuration
cp .env.example apps/web/.env.local
# Edit with local API URL + anon key + service_role key

# Test configuration
cp supabase/.env.test.example supabase/.env.test
# Edit with local API URL + anon key + service_role key
```

### Development

```bash
# Seed the database with sample data (optional)
npm run db:seed

# Start the development server
npm run dev

# Generate TypeScript types from the database schema
npm run types:generate
```

> 💡 Already have Supabase running and need to reapply the schema? Use `npm run db:reset`
> — **not** `npm run db:migrate`, which pushes to a linked remote project.

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in development mode |
| `npm run build` | Build all apps for production |
| `npm run lint` | Run ESLint across the codebase |
| `npm run test` | Run unit and integration tests |
| `npm run e2e` | Run Playwright end-to-end tests |
| `npm run types:generate` | Regenerate TypeScript types from DB |
| `npm run db:start` | Start local Supabase stack |
| `npm run db:reset` | Reset local database (drop + reapply migrations) |
| `npm run db:seed` | Seed database with sample data |

---

## 🧪 Testing

Tests run against a **real local Supabase instance** — no mocking. The CI pipeline
automatically spins up Supabase, applies migrations, runs tests, and tears down.

```bash
# Run unit & integration tests (tests/db/**, tests/rls/**)
npm run test

# Run E2E tests (starts next dev automatically)
npm run e2e
```

### Test Coverage

| Layer | What's Tested | Tools |
|-------|---------------|-------|
| **Database Functions** | Atomic operations, state transitions, race conditions | Jest + Supabase |
| **RLS Policies** | Every role × resource combination | Jest + Supabase Auth |
| **E2E: Customer Flow** | Menu browsing, ordering, status tracking | Playwright |
| **E2E: Kitchen Flow** | Order acceptance, preparation, readiness | Playwright |
| **E2E: Payment Flow** | Cash, card, digital wallet, refunds | Playwright |
| **E2E: Session Locking** | Concurrent order attempts, race conditions | Playwright |

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [`feature-spec.md`](feature-spec.md) | Complete feature specifications, API contracts, permission matrix, and Definition of Done |
| [`monorepo-structure.md`](monorepo-structure.md) | Detailed directory layout and package boundaries |
| [`docs/workflow.md`](docs/workflow.md) | Implementation workflow index and progress tracking |
| [`docs/demo.md`](docs/demo.md) | Project demo slides used for the final presentation of QR Dine, including system overview, technology stack, live workflow, team contributions, and next steps. |
| [`docs/tech-stack.md`](docs/tech-stack.md) | Technology decisions, schema reference, security model, and architecture |
| [`docs/user-guide.md`](docs/user-guide.md) | User guide: role-based instructions for using the platform |
| [`order.txt`](order.txt) | Condensed project requirements summary |
| [`CLAUDE.md`](CLAUDE.md) | AI-assisted development guidelines and project conventions |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Check the [workflow index](docs/workflow.md) for active implementation plans
4. Make your changes
5. Run tests and linter (`npm run test && npm run lint`)
6. Submit a pull request

> 💡 This project is built with AI-assisted development. See [`CLAUDE.md`](CLAUDE.md) for
> architecture rules, code style, and development conventions used by the team.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by the <strong>Team 06</strong>
  ·
  <a href="https://qrdine-demo.vercel.app">Live Demo</a>
  ·
  <a href="https://github.com/vibe-code-tours/team-06-app">GitHub</a>
</p>
