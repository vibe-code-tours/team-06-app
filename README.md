# Restaurant QR Order System

A complete QR-based ordering platform where customers scan a table QR code, browse the menu, place orders, and pay — all from their phone. Staff manage orders through dedicated dashboards with real-time updates.

🔗 **Live Demo:** https://team-06-app.netlify.app

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **UI**: Tailwind CSS + shadcn/ui
- **Validation**: Zod
- **Monorepo**: Turborepo

## Project Structure

```
TEAM-06-APP/
├── apps/
│   └── web/              # Next.js frontend
├── packages/
│   └── shared/           # Shared types, utils, validators
├── supabase/
│   ├── migrations/       # Database migrations
│   └── functions/        # Edge functions
├── docs/                 # Documentation
└── monorepo-structure.md # Detailed directory structure
```

## Getting Started

### Prerequisites

- Node.js 22+ (required by `@supabase/supabase-js`'s native WebSocket support)
- npm 10+
- Supabase CLI

### Installation

Requires Docker Desktop running (Supabase's local stack runs as Docker containers).

```bash
# Clone the repository
git clone <repository-url>
cd team-06-app

# Install dependencies (includes the Supabase CLI as a devDependency)
npm install

# Start Supabase locally — this also applies all migrations on first boot
npm run db:start

# Print your local instance's URL + keys
npx supabase status
```

`npm run db:start` prints (or `npx supabase status` re-prints) the local `API URL`,
`anon key`, and `service_role key`. Use them to fill in two separate env files —
they're for different purposes and are both gitignored:

```bash
# apps/web/.env.local — used by `npm run dev` (the Next.js app)
cp .env.example apps/web/.env.local
# edit apps/web/.env.local with the local API URL + anon key (+ service_role key)

# supabase/.env.test — used by `npm run test` (Jest/RLS/integration tests)
cp supabase/.env.test.example supabase/.env.test
# edit supabase/.env.test with the local API URL + anon key + service_role key
```

```bash
# Seed the database (optional)
npm run db:seed

# Start development server
npm run dev
```

Already have Supabase running and just need to reapply the schema (e.g. after
pulling new migrations)? Use `npm run db:reset` — **not** `npm run db:migrate`,
which pushes to a _linked remote_ project and doesn't apply to local dev.

### Development Commands

```bash
# Start all apps in development mode
npm run dev

# Build all apps
npm run build

# Run linter
npm run lint

# Run tests
npm run test

# Generate TypeScript types from database
npm run types:generate

# Push migrations to a LINKED REMOTE project (not local dev — see Getting Started)
npm run db:migrate

# Reset local database (drops + reapplies all migrations)
npm run db:reset

# Seed database
npm run db:seed
```

## Testing

Assumes you've completed [Getting Started](#getting-started) — local Supabase running
and `supabase/.env.test` filled in.

```bash
# Run unit/integration tests (tests/db/**, tests/rls/** hit the real local instance)
npm run test

# Run E2E tests (starts `next dev` automatically)
npm run e2e
```

CI runs the same flow automatically per PR — `supabase start`, apply migrations, run
tests, `supabase stop` — see `.github/workflows/ci.yml`.

## Features

### Customer Features

- Scan QR code to view menu
- Browse categories and items
- Place orders with special instructions
- View order status in real-time
- Request bill

### Staff Features

- Kitchen dashboard with real-time orders
- Order status management (Accept → Preparing → Ready)
- Table status tracking
- Payment processing (Cash, Card, Digital Wallet)
- Bill calculation with tax and discounts

### Management Features

- Restaurant settings and branding
- Menu management (categories, items, images)
- Table management with QR codes
- Staff management and role assignment
- Sales reports and analytics

### Admin Features

- Multi-restaurant management
- User management across restaurants
- System-wide settings

## User Roles

| Role             | Access                                        |
| ---------------- | --------------------------------------------- |
| Super Admin      | All restaurants, full system management       |
| Restaurant Owner | Own restaurant settings, menu, staff, reports |
| Manager          | Orders, staff scheduling, reports             |
| Kitchen Staff    | Kitchen dashboard, order status updates         |
| Waiter           | Table dashboard, order assistance            |
| Cashier          | Payment processing, bill confirmation         |
| Customer         | Menu browsing, order placement                |

## Database Schema

See `supabase/migrations/20250706000000_initial_schema.sql` for the complete schema.

### Tables

- `profiles` - User profiles with roles
- `restaurants` - Restaurant information
- `categories` - Menu categories
- `menu_items` - Menu items
- `tables` - Physical tables with QR codes
- `order_sessions` - Active dining sessions
- `orders` - Customer orders
- `order_items` - Line items in orders
- `payments` - Payment transactions

### Key Features

- Row Level Security (RLS) on all tables
- 45 RLS policies for role-based access
- Atomic functions for order creation and payment processing
- Real-time subscriptions for live updates

## API Endpoints

### Public

- `GET /api/menu/{restaurantId}` - Get restaurant menu

### Auth Required

- `POST /api/orders` - Create new order
- `GET /api/orders/{orderId}` - Get order details
- `POST /api/payments` - Process payment

### Staff Only

- `GET /api/restaurants/{id}/staff` - List restaurant staff
- `POST /api/restaurants/{id}/staff` - Invite staff

### Owner Only

- `PUT /api/restaurants/{id}` - Update restaurant
- `PUT /api/restaurants/{id}/logo` - Upload logo

### Super Admin Only

- `POST /api/restaurants` - Create restaurant
- `DELETE /api/restaurants/{id}` - Delete restaurant
- `GET /api/admin/users` - List all users

## Deployment

### netlify (Frontend)

1. Connect your GitHub repository to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy

### Supabase (Backend)

1. Create a new Supabase project
2. Run migrations: `supabase db push`
3. Set up storage buckets
4. Configure RLS policies

## Documentation

- `order.txt` - Project requirements
- `feature-spec.md` - Detailed feature specifications
- `tech-stack.md` - Technology stack details
- `monorepo-structure.md` - Directory structure guide
- `docs/workflow.md` - Implementation workflow index
- `docs/workflows/plan-1.md` - Test infrastructure workflow

## Contributing

1. Fork the repository
2. Create a feature branch
3. Check the [workflow index](docs/workflow.md) for implementation plans
4. Make your changes
5. Run tests and linter
6. Submit a pull request

## License

MIT
