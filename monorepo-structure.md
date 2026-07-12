# Monorepo Directory Structure

## Overview

This project uses a monorepo architecture with Turborepo for managing multiple packages. The structure separates frontend (Next.js), backend (Supabase), and shared code.

```
team-06-app/
├── apps/
│   ├── web/                          # Next.js Frontend Application
│   │   ├── app/                      # App Router (Next.js 13+)
│   │   │   ├── (auth)/
│   │   │   │   └── login/           # Login page
│   │   │   ├── (super-admin)/
│   │   │   │   └── super-admin/     # Super Admin dashboard
│   │   │   ├── (restaurant-owner)/
│   │   │   │   └── owner/           # Restaurant Owner dashboard
│   │   │   ├── (manager)/
│   │   │   │   └── manager/         # Manager dashboard
│   │   │   ├── (kitchen)/
│   │   │   │   └── kitchen/         # Kitchen display
│   │   │   ├── (staff)/
│   │   │   │   └── staff/           # Waiter/Staff dashboard
│   │   │   ├── (cashier)/
│   │   │   │   └── cashier/         # Cashier payment terminal
│   │   │   ├── (customer)/
│   │   │   │   └── [restaurantId]/
│   │   │   │       └── [tableNumber]/  # Customer menu view
│   │   │   ├── api/                  # API route handlers
│   │   │   │   ├── orders/          # Order CRUD
│   │   │   │   ├── payments/        # Payment processing
│   │   │   │   ├── menu/            # Menu endpoints
│   │   │   │   ├── restaurants/     # Restaurant management
│   │   │   │   ├── tables/          # Table management
│   │   │   │   ├── staff/           # Staff management
│   │   │   │   └── admin/           # Super Admin endpoints
│   │   │   ├── layout.tsx           # Root layout
│   │   │   ├── page.tsx             # Home/redirect page
│   │   │   └── globals.css          # Global styles
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── form.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   └── ... (other shadcn components)
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── DashboardLayout.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── StatsCard.tsx
│   │   │   │   ├── RecentOrders.tsx
│   │   │   │   └── QuickActions.tsx
│   │   │   ├── menu/
│   │   │   │   ├── MenuList.tsx
│   │   │   │   ├── MenuItem.tsx
│   │   │   │   ├── CategoryTabs.tsx
│   │   │   │   └── MenuEditor.tsx
│   │   │   ├── orders/
│   │   │   │   ├── OrderCard.tsx
│   │   │   │   ├── OrderList.tsx
│   │   │   │   ├── OrderStatusBadge.tsx
│   │   │   │   ├── OrderTimeline.tsx
│   │   │   │   └── CreateOrderForm.tsx
│   │   │   ├── payments/
│   │   │   │   ├── PaymentForm.tsx
│   │   │   │   ├── BillSummary.tsx
│   │   │   │   ├── PaymentHistory.tsx
│   │   │   │   └── RefundDialog.tsx
│   │   │   ├── tables/
│   │   │   │   ├── TableGrid.tsx
│   │   │   │   ├── TableCard.tsx
│   │   │   │   ├── TableStatusBadge.tsx
│   │   │   │   └── QRCodeDisplay.tsx
│   │   │   └── auth/
│   │   │       ├── LoginForm.tsx
│   │   │       ├── SignupForm.tsx
│   │   │       └── ProtectedRoute.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useRealtime.ts
│   │   │   ├── useOrders.ts
│   │   │   ├── useTables.ts
│   │   │   └── usePayments.ts
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts        # Browser client
│   │   │   │   ├── server.ts        # Server client
│   │   │   │   ├── middleware.ts     # Auth middleware
│   │   │   │   └── admin.ts         # Admin client
│   │   │   ├── utils/
│   │   │   │   ├── format.ts        # Date/currency formatting
│   │   │   │   ├── helpers.ts       # General helpers
│   │   │   │   └── constants.ts     # App constants
│   │   │   └── validators/
│   │   │       ├── order.ts         # Order Zod schemas
│   │   │       ├── payment.ts       # Payment Zod schemas
│   │   │       ├── menu.ts          # Menu Zod schemas
│   │   │       └── auth.ts          # Auth Zod schemas
│   │   ├── types/
│   │   │   ├── database.ts          # Generated Supabase types
│   │   │   ├── index.ts             # App-specific types
│   │   │   └── api.ts               # API response types
│   │   ├── middleware.ts             # Next.js middleware
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── next.config.js
│   │   └── package.json
│   │
│   └── api/                          # Backend API (Optional - if not using Supabase Edge Functions)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth/
│       │   │   │   ├── login.ts
│       │   │   │   ├── signup.ts
│       │   │   │   └── logout.ts
│       │   │   ├── restaurants/
│       │   │   │   ├── index.ts
│       │   │   │   └── [id].ts
│       │   │   ├── orders/
│       │   │   │   ├── index.ts
│       │   │   │   ├── [id].ts
│       │   │   │   └── [id]/status.ts
│       │   │   ├── payments/
│       │   │   │   ├── index.ts
│       │   │   │   └── [id]/refund.ts
│       │   │   ├── menu/
│       │   │   │   ├── categories.ts
│       │   │   │   └── items.ts
│       │   │   ├── tables/
│       │   │   │   ├── index.ts
│       │   │   │   └── [id]/qr.ts
│       │   │   ├── staff/
│       │   │   │   ├── index.ts
│       │   │   │   └── invite.ts
│       │   │   └── admin/
│       │   │       ├── users.ts
│       │   │       └── restaurants.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts
│       │   │   ├── validation.ts
│       │   │   └── errorHandler.ts
│       │   ├── utils/
│       │   │   ├── supabase.ts
│       │   │   └── helpers.ts
│       │   ├── types/
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                        # Shared code between apps
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── index.ts          # Shared type definitions
│   │   │   │   ├── database.ts       # Database types
│   │   │   │   ├── api.ts            # API types
│   │   │   │   └── enums.ts          # Shared enums
│   │   │   ├── utils/
│   │   │   │   ├── format.ts         # Formatting utilities
│   │   │   │   ├── validation.ts     # Validation helpers
│   │   │   │   └── constants.ts      # Shared constants
│   │   │   └── validators/
│   │   │       ├── order.ts
│   │   │       ├── payment.ts
│   │   │       └── menu.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui/                            # Shared UI components (optional)
│       ├── src/
│       │   ├── components/
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   └── ...
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/                          # Supabase Configuration
│   ├── migrations/
│   │   └── 20250706000000_initial_schema.sql
│   ├── functions/
│   │   ├── create-order/
│   │   │   └── index.ts
│   │   ├── process-payment/
│   │   │   └── index.ts
│   │   └── release-table/
│   │       └── index.ts
│   ├── seed/
│   │   └── seed.sql
│   ├── config.toml
│   └── .env.local
│
├── docs/                              # Documentation
│   ├── api/
│   │   ├── endpoints.md
│   │   └── authentication.md
│   ├── guides/
│   │   ├── setup.md
│   │   ├── development.md
│   │   └── deployment.md
│   └── architecture/
│       ├── overview.md
│       └── database.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── cd-staging.yml
│       └── cd-production.yml
│
├── apps/
│   └── web/
│       └── public/
│           ├── images/
│           │   ├── logo.svg
│           │   └── placeholder.png
│           └── favicon.ico
│
├── turbo.json                         # Turborepo configuration
├── package.json                       # Root package.json
├── tsconfig.json                      # Root TypeScript config
├── .gitignore
├── .env.example
├── README.md
├── feature-spec.md
├── tech-stack.md
└── order.txt
```

## Key Files

### Root Configuration

**package.json** (Root)
```json
{
  "name": "restaurant-qr-order",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "db:migrate": "supabase db push",
    "db:reset": "supabase db reset",
    "db:seed": "supabase db seed",
    "types:generate": "supabase gen types typescript > packages/shared/src/types/database.ts"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

**turbo.json**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Frontend (apps/web)

**package.json**
```json
{
  "name": "@restaurant-qr/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "qrcode": "^1.5.3",
    "zod": "^3.23.0",
    "react-hook-form": "^7.52.0",
    "@hookform/resolvers": "^3.9.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.4.0",
    "lucide-react": "^0.400.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.0.0"
  }
}
```

### Shared Package (packages/shared)

**package.json**
```json
{
  "name": "@restaurant-qr/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

## Folder Purposes

| Folder | Purpose |
|--------|---------|
| `apps/web` | Next.js frontend application |
| `apps/api` | Optional Express/Fastify backend (if not using Supabase Edge Functions) |
| `packages/shared` | Shared types, utilities, and validators |
| `packages/ui` | Shared React components (optional) |
| `supabase` | Supabase configuration, migrations, edge functions |
| `docs` | Project documentation |
| `.github/workflows` | CI/CD pipelines |

## Development Workflow

1. **Install dependencies**: `npm install` (from root)
2. **Start development**: `npm run dev` (runs all apps)
3. **Generate types**: `npm run types:generate`
4. **Run migrations**: `npm run db:migrate`
5. **Seed database**: `npm run db:seed`

## Environment Variables

```env
# Root .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```
