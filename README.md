# Restaurant QR Order System

A complete QR-based ordering platform where customers scan a table QR code, browse the menu, place orders, and pay — all from their phone. Staff manage orders through dedicated dashboards with real-time updates.

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

- Node.js 18+
- npm 9+
- Supabase CLI

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd team-06-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start Supabase locally (optional)
supabase start

# Run database migrations
npm run db:migrate

# Seed the database (optional)
npm run db:seed

# Start development server
npm run dev
```

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

# Run database migrations
npm run db:migrate

# Reset database
npm run db:reset

# Seed database
npm run db:seed
```

## Testing

1. Install the Supabase CLI (already a devDependency): `npm install`
2. Start the local Supabase stack: `npm run db:start`
3. Copy `supabase/.env.test.example` to `supabase/.env.test` and fill in
   the anon key and service_role key printed by `db:start`.
4. Apply the schema: `npm run db:reset`
5. Run unit/integration tests: `npm run test`
6. Run E2E tests: `npm run e2e` (starts `next dev` automatically)

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
| Kitchen Staff    | Kitchen display, order status updates         |
| Waiter           | Table management, order assistance            |
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

### Vercel (Frontend)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linter
5. Submit a pull request

## License

MIT
