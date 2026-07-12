# Test Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the testing stack (Jest unit/integration tests, an RLS-testing harness against local Supabase, and Playwright E2E) so every later plan in this series can write real, runnable tests instead of deferring them.

**Architecture:** Jest runs in `apps/web` for unit/integration tests (services, DB function wrappers, RLS policies via `pg` client against a local Supabase instance). Playwright runs at the repo root against a running `next dev` + local Supabase stack for E2E flows. The Supabase CLI drives a local Postgres instance (`supabase start`) that migrations apply to; tests connect to it directly.

**Tech Stack:** Jest, ts-jest, `@supabase/supabase-js` (test clients), `pg` (raw RLS assertions), Playwright, Supabase CLI (local dev stack).

## Global Constraints

- TypeScript strict mode everywhere (per `CLAUDE.md`).
- No `any` without a comment explaining why (per `CLAUDE.md`).
- 4-space indentation, no semicolons — match existing files (per `CLAUDE.md`). Existing files in this repo (e.g. `apps/web/lib/supabase/client.ts`) actually use 2-space indentation and semicolons; follow the **existing file style** (2-space, semicolons) since CLAUDE.md says "match existing files" and that is what's on disk.
- Every mutation must eventually be permission-checked at RLS, API, and UI layers — integration tests in this plan exist to verify the RLS layer specifically (per `CLAUDE.md` and `feature-spec.md` Definition of Done).
- Tests required per `feature-spec.md` Definition of Done: unit tests for DB function wrappers/services, integration tests for RLS (all 7 roles × permission matrix), E2E for customer/kitchen/payment/session-locking flows.

---

## File Structure

```
restaurant-qr-order/
├── apps/web/
│   ├── jest.config.ts                     # NEW — Jest config for apps/web
│   ├── jest.setup.ts                      # NEW — loads .env.test, global test hooks
│   └── package.json                       # MODIFY — add test scripts + devDependencies
├── supabase/
│   └── .env.test.example                  # NEW — local Supabase test env template
├── tests/
│   ├── helpers/
│   │   ├── supabaseTestClient.ts          # NEW — service-role + per-role client factories
│   │   ├── seedTestData.ts                # NEW — creates restaurant/profiles/tables fixtures
│   │   └── resetDatabase.ts               # NEW — truncates tables between test runs
│   └── rls/
│       └── rls-smoke.test.ts              # NEW — first RLS test proving the harness works
├── playwright.config.ts                   # NEW — root Playwright config
├── e2e/
│   └── smoke.spec.ts                      # NEW — trivial E2E proving the harness works
├── package.json                           # MODIFY — add root test/e2e scripts + Playwright devDep
└── turbo.json                             # MODIFY — wire "test" task outputs/env
```

**Responsibilities:**
- `tests/helpers/supabaseTestClient.ts` — the only place that knows how to build a Supabase client authenticated as a given role. Every later plan's RLS tests import from here.
- `tests/helpers/seedTestData.ts` — the only place that creates baseline fixture rows (restaurant, profiles per role, table). Later plans' tests call this instead of hand-rolling fixtures.
- `tests/helpers/resetDatabase.ts` — truncates all `public` tables (respecting FK order) so each test file starts clean.
- `apps/web/jest.config.ts` — unit/integration test runner config, scoped to `apps/web` so component/service tests can use Next.js path aliases (`@/*`, `@restaurant-qr/shared`).
- `playwright.config.ts` at repo root — E2E config, since Playwright drives the built app, not a single package.

---

### Task 1: Install Supabase CLI and start local stack

**Files:**
- Modify: `package.json` (root) — add `supabase` devDependency and `db:start`/`db:stop` scripts
- Create: `supabase/.env.test.example`

**Interfaces:**
- Produces: a running local Supabase stack on the ports defined in `supabase/config.toml` (API `54321`, DB `54322`, Studio `54323`) that later tasks connect to.

- [ ] **Step 1: Install the Supabase CLI as a root devDependency**

```bash
npm install --save-dev supabase --workspace-root
```

Run from repo root. This installs the `supabase` CLI binary locally (no global install, no Homebrew dependency) and adds it to root `package.json` devDependencies.

- [ ] **Step 2: Add root package.json scripts**

Edit root `package.json`, inside `"scripts"`:

```json
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
```

(`db:migrate`, `db:seed`, `types:generate` already exist — leave them as-is.)

- [ ] **Step 3: Create the test env template**

Create `supabase/.env.test.example`:

```
# Copy to supabase/.env.test and fill in values printed by `npm run db:start`.
# These point tests at the LOCAL Supabase stack only — never production.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 4: Start the local stack and capture keys**

Run: `npm run db:start`
Expected output includes `API URL`, `anon key`, and `service_role key`. Copy `supabase/.env.test.example` to `supabase/.env.test` and fill in the `anon key` and `service_role key` values from the command output.

- [ ] **Step 5: Verify the migration applies cleanly**

Run: `npm run db:reset`
Expected: output ends with `Applying migration 20250706000000_initial_schema.sql...` followed by `Finished supabase db reset` with no errors. If it errors, stop here and fix the migration before continuing — every later task depends on this succeeding.

- [ ] **Step 6: Add `supabase/.env.test` to `.gitignore`**

Check `.gitignore` for an existing `.env*` ignore pattern (the repo already has `.env.example` tracked, so confirm `.env.test` isn't accidentally committed). If no blanket `.env*` rule exists, append:

```
supabase/.env.test
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json supabase/.env.test.example .gitignore
git commit -m "chore: add Supabase CLI and local test stack scripts"
```

---

### Task 2: Database reset and seed helpers

**Files:**
- Create: `tests/helpers/resetDatabase.ts`
- Create: `tests/helpers/seedTestData.ts`
- Test: `tests/helpers/resetDatabase.test.ts`

**Interfaces:**
- Consumes: `supabase/.env.test` (loaded via `dotenv`), `@supabase/supabase-js` service-role client.
- Produces:
  - `resetDatabase(client: SupabaseClient): Promise<void>`
  - `seedTestData(client: SupabaseClient): Promise<SeedFixture>` where
    ```typescript
    interface SeedFixture {
      restaurantId: string
      tableId: string
      categoryId: string
      menuItemId: string
      profiles: Record<
        'super_admin' | 'restaurant_owner' | 'manager' | 'kitchen_staff' | 'waiter' | 'cashier',
        { userId: string; email: string; password: string }
      >
    }
    ```
  These two functions are imported by every later plan's integration tests.

- [ ] **Step 1: Install test dependencies in apps/web**

```bash
npm install --save-dev jest ts-jest @types/jest dotenv --workspace=apps/web
```

- [ ] **Step 2: Write the failing test for resetDatabase**

Create `tests/helpers/resetDatabase.test.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resetDatabase } from './resetDatabase';

config({ path: 'supabase/.env.test' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('resetDatabase', () => {
  it('removes all rows from restaurants table', async () => {
    await client.from('restaurants').insert({ name: 'Leftover Diner' });

    await resetDatabase(client);

    const { data, error } = await client.from('restaurants').select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `npx jest tests/helpers/resetDatabase.test.ts --config apps/web/jest.config.ts` (config created in Step 5 below — expect a "Cannot find module './resetDatabase'" failure for now; this confirms the test file itself is wired up once the config exists. If the config doesn't exist yet, skip straight to Step 3 and come back to run this after Step 6.)

- [ ] **Step 3: Implement resetDatabase**

Create `tests/helpers/resetDatabase.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

// Order matters: children before parents, to satisfy FK constraints.
const TABLES_IN_DELETE_ORDER = [
  'payments',
  'order_items',
  'orders',
  'order_sessions',
  'tables',
  'menu_items',
  'categories',
  'restaurants',
  'profiles',
] as const;

export async function resetDatabase(client: SupabaseClient): Promise<void> {
  for (const table of TABLES_IN_DELETE_ORDER) {
    const { error } = await client
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      throw new Error(`Failed to clear table ${table}: ${error.message}`);
    }
  }
}
```

`profiles` rows for auth users must be deleted after `auth.users` rows are removed, but service-role delete on `profiles` alone is enough here since `ON DELETE CASCADE` from `auth.users` isn't triggered by this helper — auth users are cleaned up separately in `seedTestData`'s counterpart teardown (Task 3 handles per-suite auth user creation/deletion, not this helper).

- [ ] **Step 4: Create jest.config.ts**

Create `apps/web/jest.config.ts`:

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/apps/web/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/$1',
    '^@restaurant-qr/shared$': '<rootDir>/packages/shared/src',
  },
  setupFiles: ['<rootDir>/apps/web/jest.setup.ts'],
};

export default config;
```

- [ ] **Step 5: Create jest.setup.ts**

Create `apps/web/jest.setup.ts`:

```typescript
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../supabase/.env.test') });
```

- [ ] **Step 6: Add test script to apps/web/package.json**

Edit `apps/web/package.json`, inside `"scripts"`:

```json
    "test": "jest --config jest.config.ts",
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/helpers/resetDatabase.test.ts`
Expected: `PASS tests/helpers/resetDatabase.test.ts`

- [ ] **Step 8: Write seedTestData (no separate failing-test step — covered by rls-smoke.test.ts in Task 3)**

Create `tests/helpers/seedTestData.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SeedProfile {
  userId: string;
  email: string;
  password: string;
}

export interface SeedFixture {
  restaurantId: string;
  tableId: string;
  categoryId: string;
  menuItemId: string;
  profiles: Record<
    | 'super_admin'
    | 'restaurant_owner'
    | 'manager'
    | 'kitchen_staff'
    | 'waiter'
    | 'cashier',
    SeedProfile
  >;
}

const ROLES = [
  'super_admin',
  'restaurant_owner',
  'manager',
  'kitchen_staff',
  'waiter',
  'cashier',
] as const;

// serviceClient must be created with the service_role key — this bypasses RLS
// to create fixtures, and uses admin.createUser to seed auth.users directly.
export async function seedTestData(
  serviceClient: SupabaseClient
): Promise<SeedFixture> {
  const { data: restaurant, error: restaurantError } = await serviceClient
    .from('restaurants')
    .insert({ name: 'Test Restaurant', tax_rate: 0.1 })
    .select()
    .single();
  if (restaurantError) throw new Error(restaurantError.message);

  const { data: category, error: categoryError } = await serviceClient
    .from('categories')
    .insert({ restaurant_id: restaurant.id, name: 'Mains', sort_order: 0 })
    .select()
    .single();
  if (categoryError) throw new Error(categoryError.message);

  const { data: menuItem, error: menuItemError } = await serviceClient
    .from('menu_items')
    .insert({
      restaurant_id: restaurant.id,
      category_id: category.id,
      name: 'Test Burger',
      price: 12.5,
    })
    .select()
    .single();
  if (menuItemError) throw new Error(menuItemError.message);

  const { data: table, error: tableError } = await serviceClient
    .from('tables')
    .insert({ restaurant_id: restaurant.id, table_number: 1 })
    .select()
    .single();
  if (tableError) throw new Error(tableError.message);

  const profiles = {} as SeedFixture['profiles'];

  for (const role of ROLES) {
    const email = `${role}@test.local`;
    const password = 'test-password-123';

    const { data: authUser, error: authError } =
      await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role,
          restaurant_id: role === 'super_admin' ? null : restaurant.id,
        },
      });
    if (authError || !authUser.user) {
      throw new Error(authError?.message ?? 'Failed to create auth user');
    }

    profiles[role] = { userId: authUser.user.id, email, password };
  }

  return {
    restaurantId: restaurant.id,
    tableId: table.id,
    categoryId: category.id,
    menuItemId: menuItem.id,
    profiles,
  };
}
```

- [ ] **Step 9: Commit**

```bash
git add tests/helpers apps/web/jest.config.ts apps/web/jest.setup.ts apps/web/package.json package.json package-lock.json
git commit -m "test: add Jest config and RLS test fixture helpers"
```

---

### Task 3: Per-role authenticated client factory + first RLS smoke test

**Files:**
- Create: `tests/helpers/supabaseTestClient.ts`
- Test: `tests/rls/rls-smoke.test.ts`

**Interfaces:**
- Consumes: `SeedFixture` from Task 2's `seedTestData.ts`.
- Produces:
  - `createServiceClient(): SupabaseClient` — service-role client, bypasses RLS.
  - `createAnonClient(): SupabaseClient` — unauthenticated anon-key client.
  - `createRoleClient(email: string, password: string): Promise<SupabaseClient>` — signs in and returns a client scoped to that user's JWT. Every later plan's RLS test imports `createRoleClient` and `createServiceClient` from this file.

- [ ] **Step 1: Write the failing smoke test**

Create `tests/rls/rls-smoke.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient, createAnonClient, createRoleClient } from '../helpers/supabaseTestClient';

describe('RLS harness smoke test', () => {
  const serviceClient = createServiceClient();

  beforeEach(async () => {
    await resetDatabase(serviceClient);
  });

  it('lets an anonymous client read an active restaurant', async () => {
    const fixture = await seedTestData(serviceClient);
    const anonClient = createAnonClient();

    const { data, error } = await anonClient
      .from('restaurants')
      .select('id')
      .eq('id', fixture.restaurantId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('blocks an anonymous client from reading profiles', async () => {
    await seedTestData(serviceClient);
    const anonClient = createAnonClient();

    const { data, error } = await anonClient.from('profiles').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('lets a restaurant_owner read their own restaurant profiles', async () => {
    const fixture = await seedTestData(serviceClient);
    const ownerClient = await createRoleClient(
      fixture.profiles.restaurant_owner.email,
      fixture.profiles.restaurant_owner.password
    );

    const { data, error } = await ownerClient
      .from('profiles')
      .select('id')
      .eq('restaurant_id', fixture.restaurantId);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- tests/rls/rls-smoke.test.ts`
Expected: FAIL with "Cannot find module '../helpers/supabaseTestClient'"

- [ ] **Step 3: Implement supabaseTestClient.ts**

Create `tests/helpers/supabaseTestClient.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} — copy supabase/.env.test.example to supabase/.env.test`);
  }
  return value;
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export function createAnonClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function createRoleClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  }
  return client;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/rls/rls-smoke.test.ts`
Expected: `PASS tests/rls/rls-smoke.test.ts` (3 tests passing)

If the "blocks an anonymous client from reading profiles" test fails (returns rows), stop — this means the `profiles` RLS policy is misconfigured and must be fixed in the db-schema plan before proceeding with any other plan.

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/supabaseTestClient.ts tests/rls/rls-smoke.test.ts
git commit -m "test: add per-role Supabase client factory and RLS smoke test"
```

---

### Task 4: Playwright E2E harness

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `package.json` (root) — add `e2e` script and Playwright devDependency

**Interfaces:**
- Produces: `npm run e2e` runs Playwright against `next dev` on `http://localhost:3000`. Later plans' E2E specs live in `e2e/*.spec.ts` and reuse `tests/helpers/seedTestData.ts` for setup via Playwright's `globalSetup`.

- [ ] **Step 1: Install Playwright**

```bash
npm install --save-dev @playwright/test --workspace-root
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Create playwright.config.ts**

Create `playwright.config.ts` at repo root:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  webServer: {
    command: 'npm run dev --workspace=apps/web',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
});
```

- [ ] **Step 3: Write the smoke E2E spec**

Create `e2e/smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('root path redirects to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 4: Add root package.json script**

Edit root `package.json`, inside `"scripts"`:

```json
    "e2e": "playwright test",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run e2e`
Expected: `1 passed` — this exercises `apps/web/app/page.tsx`'s `redirect('/login')` and confirms Playwright can drive the real dev server. Note: this test will only pass once `apps/web/app/(auth)/login/page.tsx` actually renders at `/login` without erroring (it currently has no content per the file listing — if it 404s or errors, that's expected until the auth-and-middleware plan builds it; treat this spec as a harness check on `next dev` booting, not a feature check, and adjust the assertion to `await expect(page).not.toHaveURL('/')` if `/login` isn't renderable yet).

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/smoke.spec.ts package.json package-lock.json
git commit -m "test: add Playwright E2E harness"
```

---

### Task 5: Wire test task into Turborepo and document the workflow

**Files:**
- Modify: `turbo.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `npm run test` (root) runs all workspace tests via Turborepo; documents the one-time local setup for future contributors.

- [ ] **Step 1: Update turbo.json test task**

Edit `turbo.json`, replace the `"test"` task:

```json
    "test": {
      "dependsOn": ["^build"],
      "env": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      "outputs": []
    }
```

- [ ] **Step 2: Verify root test script runs the workspace**

Run: `npm run test`
Expected: Turborepo runs `apps/web`'s `test` script; output ends with `Tasks: 1 successful, 1 total`.

- [ ] **Step 3: Document setup in README**

Read the current `README.md` first, then add a "Testing" section after the existing setup instructions (exact insertion point depends on current README content — append as a new `## Testing` section if no better location exists):

```markdown
## Testing

1. Install the Supabase CLI (already a devDependency): `npm install`
2. Start the local Supabase stack: `npm run db:start`
3. Copy `supabase/.env.test.example` to `supabase/.env.test` and fill in
   the anon key and service_role key printed by `db:start`.
4. Apply the schema: `npm run db:reset`
5. Run unit/integration tests: `npm run test`
6. Run E2E tests: `npm run e2e` (starts `next dev` automatically)
```

- [ ] **Step 4: Commit**

```bash
git add turbo.json README.md
git commit -m "docs: document test setup workflow"
```

---

## Definition of Done for this plan

- [ ] `npm run db:start` brings up a local Supabase stack and `npm run db:reset` applies the existing migration cleanly.
- [ ] `npm run test` (root) passes, including the RLS smoke test proving anon/service/per-role clients all behave correctly.
- [ ] `npm run e2e` passes the harness smoke spec.
- [ ] `tests/helpers/{resetDatabase,seedTestData,supabaseTestClient}.ts` exist with the exact exported signatures documented above — every later plan's tests depend on these signatures matching.
