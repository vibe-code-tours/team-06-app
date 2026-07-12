# Owner Features (Menu, Table, Staff Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three "coming soon" placeholder tabs on the owner dashboard (Menu, Table, Staff management) with working CRUD, add the staff invite flow required by `feature-spec.md` §11, add category management, and add logo/menu-image upload using the storage buckets already provisioned in `db-schema.md`.

**Architecture:** Each management area gets a Zod-validated API route for mutations (create/update/delete), reusing the existing `categorySchema`/`menuItemSchema`/`tableSchema`/`inviteStaffSchema` validators already defined in `packages/shared/src/validators/index.ts` (currently unused by the app). Reads stay direct client→Supabase. New tables reuse `tableService.getTableQrDataUrl`/`releaseTable` from `staff-dashboard.md`. Staff invite uses Supabase Auth's admin invite API, requiring a new server-only admin client. Logo/image upload persists via `PUT /api/restaurants/:id` (from the sibling `restaurant-management.md` plan).

**Tech Stack:** Next.js Route Handlers, Zod validators (existing, previously unused), Supabase Storage (buckets from `db-schema.md`), Supabase Auth Admin API (`supabase.auth.admin.inviteUserByEmail`).

**Depends on:** `2026-07-08-test-infrastructure.md`, `2026-07-08-db-schema.md`, `2026-07-09-kitchen-dashboard.md` (for the shared `ok()`/`err()` response envelope in `packages/shared/src/http/apiResponse.ts`), `2026-07-09-staff-dashboard.md` (for `tableService.ts`) must be complete.

**Sibling plan:** `2026-07-09-restaurant-management.md` covers restaurant create/edit and the super-admin dashboard — split out so both can be built in parallel by different developers. This plan's Task 6 (logo upload) calls `PUT /api/restaurants/:id`, which `restaurant-management.md` builds; that route already accepts a `logo_url` field for exactly this purpose (see that plan's Task 1 Interfaces note). No other file overlap between the two plans.

## Global Constraints

- Handlers stay thin; atomic operations stay in Postgres functions where they exist (per `CLAUDE.md`). Menu/table CRUD has no dedicated Postgres function in the migration — plain validated inserts/updates through the API layer are appropriate here since there's no multi-step invariant to protect (unlike orders/payments).
- Every mutation is permission-checked at three layers: RLS, API route, UI (per `CLAUDE.md`). Permission matrix from `feature-spec.md` §11:
  - Menu category/item create/edit/delete: Owner, Manager (not Kitchen/Waiter/Cashier), Super Admin.
  - Table create/edit: Owner, Manager, Super Admin. Table delete: Owner only, Super Admin.
  - Staff invite: Owner only, Super Admin.
- All API route handlers return responses via `ok()`/`err()` from `packages/shared/src/http/apiResponse.ts` (established in `kitchen-dashboard.md`) — never call `NextResponse.json(...)` directly.
- No secrets in code; `SUPABASE_SERVICE_ROLE_KEY` is server-only, never imported into a client component (per `CLAUDE.md`) — the staff-invite route needs the service-role key (admin API) and must live entirely in a Route Handler.
- All API inputs validated with Zod schemas from `packages/shared/src/validators/` (per `CLAUDE.md`) — this plan is what finally wires up the schemas that already exist but are unused.

---

## File Structure

```
restaurant-qr-order/
├── apps/web/
│   ├── app/
│   │   ├── api/
│   │   │   ├── categories/
│   │   │   │   ├── route.ts                    # NEW — POST: create category
│   │   │   │   └── [categoryId]/route.ts        # NEW — PUT/DELETE
│   │   │   ├── uploads/
│   │   │   │   └── route.ts                    # NEW — POST: upload logo/menu image, returns public URL
│   │   │   ├── menu-items/
│   │   │   │   ├── route.ts                    # NEW — POST: create item
│   │   │   │   └── [menuItemId]/route.ts        # NEW — PUT/DELETE
│   │   │   ├── tables/
│   │   │   │   ├── route.ts                    # NEW — POST: create table (+ QR)
│   │   │   │   └── [tableId]/route.ts           # NEW — PUT/DELETE (sibling of staff-dashboard.md's [tableId]/release and [tableId]/qr subroutes)
│   │   │   └── staff/
│   │   │       └── invite/route.ts              # NEW — POST: invite staff
│   │   └── (restaurant-owner)/owner/
│   │       ├── page.tsx                         # MODIFY — wire tabs to real components, add logo upload
│   │       ├── MenuManagementTab.tsx             # NEW
│   │       ├── TableManagementTab.tsx            # NEW
│   │       └── StaffManagementTab.tsx            # NEW
│   └── lib/
│       ├── supabase/
│       │   └── admin.ts                         # NEW — service-role client (server-only)
│       └── services/
│           ├── menuService.ts                    # NEW
│           ├── tableService.ts                    # MODIFY (extends staff-dashboard.md's version)
│           └── staffService.ts                    # NEW
└── tests/
    ├── services/
    │   ├── menuService.test.ts
    │   ├── tableService.test.ts                   # MODIFY (extends staff-dashboard.md's version)
    │   └── staffService.test.ts
    └── api/
        ├── categories-route.test.ts
        ├── menu-items-route.test.ts
        ├── tables-crud-route.test.ts
        ├── staff-invite-route.test.ts
        └── uploads-route.test.ts
```

---

### Task 1: Server-only Supabase admin client

**Files:**
- Create: `apps/web/lib/supabase/admin.ts`

**Interfaces:**
- Produces: `createAdminClient(): SupabaseClient` — uses `SUPABASE_SERVICE_ROLE_KEY`, never imported outside `apps/web/app/api/**`. Consumed by the staff-invite route (Task 4).

- [ ] **Step 1: Implement the admin client**

Create `apps/web/lib/supabase/admin.ts`:

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// SERVER-ONLY. Uses the service_role key which bypasses RLS entirely.
// Never import this file from a client component or anything bundled to the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/supabase/admin.ts
git commit -m "feat: add server-only Supabase admin client"
```

---

### Task 2: Menu (categories + menu items) service and API routes

**Files:**
- Create: `apps/web/lib/services/menuService.ts`
- Create: `apps/web/app/api/categories/route.ts`
- Create: `apps/web/app/api/categories/[categoryId]/route.ts`
- Create: `apps/web/app/api/menu-items/route.ts`
- Create: `apps/web/app/api/menu-items/[menuItemId]/route.ts`
- Test: `tests/services/menuService.test.ts`
- Test: `tests/api/categories-route.test.ts`
- Test: `tests/api/menu-items-route.test.ts`

**Interfaces:**
- Consumes: `categorySchema`, `menuItemSchema` from `@restaurant-qr/shared`.
- Produces:
  - `createCategory(client, restaurantId, input: CategoryInput): Promise<{ id: string } | { error: string }>`
  - `updateCategory(client, categoryId, input: Partial<CategoryInput>): Promise<{ success: true } | { error: string }>`
  - `deleteCategory(client, categoryId): Promise<{ success: true } | { error: string }>`
  - `createMenuItem(client, restaurantId, input: MenuItemInput): Promise<{ id: string } | { error: string }>`
  - `deleteMenuItem(client, menuItemId): Promise<{ success: true } | { error: string }>`
  - Routes: `POST /api/categories`, `PUT/DELETE /api/categories/:id`, `POST /api/menu-items`, `PUT/DELETE /api/menu-items/:id`.

`updateCategory` is included from the start (unlike the original combined plan, which added it as a later patch) since category editing is core to a usable Menu tab — see Task 5.

- [ ] **Step 1: Write the failing service test**

Create `tests/services/menuService.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';
import { createCategory, updateCategory, deleteCategory, createMenuItem, deleteMenuItem } from '../../apps/web/lib/services/menuService';

describe('menuService', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('creates a category', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await createCategory(serviceClient, fixture.restaurantId, {
      name: 'Desserts',
      sort_order: 1,
      is_active: true,
    });

    expect('id' in result).toBe(true);
  });

  it('renames a category', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await updateCategory(serviceClient, fixture.categoryId, { name: 'Renamed' });

    expect(result).toEqual({ success: true });
    const { data } = await serviceClient.from('categories').select('name').eq('id', fixture.categoryId).single();
    expect(data!.name).toBe('Renamed');
  });

  it('reorders a category via sort_order', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await updateCategory(serviceClient, fixture.categoryId, { sort_order: 5 });

    expect(result).toEqual({ success: true });
    const { data } = await serviceClient.from('categories').select('sort_order').eq('id', fixture.categoryId).single();
    expect(data!.sort_order).toBe(5);
  });

  it('creates a menu item under a category', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await createMenuItem(serviceClient, fixture.restaurantId, {
      name: 'Ice Cream',
      description: 'Vanilla',
      price: 5.5,
      category_id: fixture.categoryId,
      is_available: true,
      sort_order: 0,
    });

    expect('id' in result).toBe(true);
  });

  it('rejects a menu item whose category belongs to a different restaurant', async () => {
    const fixtureA = await seedTestData(serviceClient);
    const fixtureB = await seedTestData(serviceClient);

    const result = await createMenuItem(serviceClient, fixtureA.restaurantId, {
      name: 'Cross-tenant item',
      description: '',
      price: 1,
      category_id: fixtureB.categoryId,
      is_available: true,
      sort_order: 0,
    });

    expect('error' in result).toBe(true);
  });

  it('deletes a category', async () => {
    const fixture = await seedTestData(serviceClient);
    const created = await createCategory(serviceClient, fixture.restaurantId, {
      name: 'To Delete',
      sort_order: 2,
      is_active: true,
    });
    if (!('id' in created)) throw new Error('setup failed');

    const result = await deleteCategory(serviceClient, created.id);

    expect(result).toEqual({ success: true });
  });

  it('deleteMenuItem fails for an item that has been ordered (FK RESTRICT)', async () => {
    const fixture = await seedTestData(serviceClient);
    await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });

    const result = await deleteMenuItem(serviceClient, fixture.menuItemId);

    expect('error' in result).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- tests/services/menuService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement menuService.ts**

Create `apps/web/lib/services/menuService.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CategoryInput, MenuItemInput } from '@restaurant-qr/shared';

export type ServiceResult<T> = T | { error: string };

export async function createCategory(
  client: SupabaseClient,
  restaurantId: string,
  input: CategoryInput
): Promise<ServiceResult<{ id: string }>> {
  const { data, error } = await client
    .from('categories')
    .insert({ restaurant_id: restaurantId, ...input })
    .select('id')
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function updateCategory(
  client: SupabaseClient,
  categoryId: string,
  input: Partial<CategoryInput>
): Promise<ServiceResult<{ success: true }>> {
  const { error } = await client.from('categories').update(input).eq('id', categoryId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteCategory(
  client: SupabaseClient,
  categoryId: string
): Promise<ServiceResult<{ success: true }>> {
  const { error } = await client.from('categories').delete().eq('id', categoryId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function createMenuItem(
  client: SupabaseClient,
  restaurantId: string,
  input: MenuItemInput
): Promise<ServiceResult<{ id: string }>> {
  const { data: category, error: categoryError } = await client
    .from('categories')
    .select('id')
    .eq('id', input.category_id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (categoryError) return { error: categoryError.message };
  if (!category) return { error: 'Category does not belong to this restaurant' };

  const { data, error } = await client
    .from('menu_items')
    .insert({ restaurant_id: restaurantId, ...input })
    .select('id')
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function deleteMenuItem(
  client: SupabaseClient,
  menuItemId: string
): Promise<ServiceResult<{ success: true }>> {
  const { error } = await client.from('menu_items').delete().eq('id', menuItemId);
  if (error) return { error: error.message };
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/services/menuService.test.ts`
Expected: `PASS` — all 7 tests green.

- [ ] **Step 5: Write failing API route tests**

Create `tests/api/categories-route.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

describe('POST /api/categories', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('rejects an empty name with 400', async () => {
    const fixture = await seedTestData(serviceClient);

    const response = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: fixture.restaurantId, name: '' }),
    });

    expect(response.status).toBe(400);
  });
});

describe('PUT /api/categories/[categoryId]', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('rejects an empty name update with 400', async () => {
    const fixture = await seedTestData(serviceClient);

    const response = await fetch(`${BASE_URL}/api/categories/${fixture.categoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
  });
});
```

Create `tests/api/menu-items-route.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

describe('POST /api/menu-items', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('rejects a negative price with 400', async () => {
    const fixture = await seedTestData(serviceClient);

    const response = await fetch(`${BASE_URL}/api/menu-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: fixture.restaurantId,
        name: 'Bad Item',
        price: -5,
        category_id: fixture.categoryId,
      }),
    });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Start dev server: `npm run dev --workspace=apps/web`
Run: `npm run test --workspace=apps/web -- tests/api/categories-route.test.ts tests/api/menu-items-route.test.ts`
Expected: both FAIL (404).

- [ ] **Step 7: Implement the route handlers**

Create `apps/web/app/api/categories/route.ts`:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { categorySchema } from '@restaurant-qr/shared';
import { createCategory } from '@/lib/services/menuService';

const ALLOWED_ROLES = ['restaurant_owner', 'manager', 'super_admin'];

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json().catch(() => null);
  const restaurantId = body?.restaurant_id;
  const parsed = categorySchema.safeParse(body);

  if (!restaurantId || !parsed.success) {
    return err('VALIDATION_ERROR', parsed.success ? 'restaurant_id is required' : parsed.error.errors.map((e) => e.message).join(', '), 400);
  }

  const result = await createCategory(supabase, restaurantId, parsed.data);
  if ('error' in result) return err('CONFLICT', result.error, 422);
  return ok(result, 201);
}
```

Create `apps/web/app/api/categories/[categoryId]/route.ts`:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { categorySchema } from '@restaurant-qr/shared';
import { updateCategory, deleteCategory } from '@/lib/services/menuService';

const ALLOWED_ROLES = ['restaurant_owner', 'manager', 'super_admin'];
const DELETE_ROLES = ['restaurant_owner', 'super_admin'];

export async function PUT(
  request: Request,
  { params }: { params: { categoryId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.partial().safeParse(body);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.errors.map((e) => e.message).join(', '), 400);
  }

  const result = await updateCategory(supabase, params.categoryId, parsed.data);
  if ('error' in result) return err('CONFLICT', result.error, 422);
  return ok(result, 200);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { categoryId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !DELETE_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const result = await deleteCategory(supabase, params.categoryId);
  if ('error' in result) return err('CONFLICT', result.error, 422);
  return ok(result, 200);
}
```

Create `apps/web/app/api/menu-items/route.ts`:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { menuItemSchema } from '@restaurant-qr/shared';
import { createMenuItem } from '@/lib/services/menuService';

const ALLOWED_ROLES = ['restaurant_owner', 'manager', 'super_admin'];

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json().catch(() => null);
  const restaurantId = body?.restaurant_id;
  const parsed = menuItemSchema.safeParse(body);

  if (!restaurantId || !parsed.success) {
    return err('VALIDATION_ERROR', parsed.success ? 'restaurant_id is required' : parsed.error.errors.map((e) => e.message).join(', '), 400);
  }

  const result = await createMenuItem(supabase, restaurantId, parsed.data);
  if ('error' in result) return err('CONFLICT', result.error, 422);
  return ok(result, 201);
}
```

Create `apps/web/app/api/menu-items/[menuItemId]/route.ts`. This route's `PUT` handler accepts either `is_available` (quick toggle) or `image_url` (set by Task 6's image upload), since both are simple partial updates to the same row:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { deleteMenuItem } from '@/lib/services/menuService';

const ALLOWED_ROLES = ['restaurant_owner', 'manager', 'super_admin'];

export async function DELETE(
  _request: Request,
  { params }: { params: { menuItemId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const result = await deleteMenuItem(supabase, params.menuItemId);
  if ('error' in result) return err('CONFLICT', result.error, 422);
  return ok(result, 200);
}

export async function PUT(
  request: Request,
  { params }: { params: { menuItemId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || (typeof body.is_available !== 'boolean' && typeof body.image_url !== 'string')) {
    return err('VALIDATION_ERROR', 'is_available (boolean) or image_url (string) is required', 400);
  }

  const updatePayload: { is_available?: boolean; image_url?: string } = {};
  if (typeof body.is_available === 'boolean') updatePayload.is_available = body.is_available;
  if (typeof body.image_url === 'string') updatePayload.image_url = body.image_url;

  const { error } = await supabase
    .from('menu_items')
    .update(updatePayload)
    .eq('id', params.menuItemId);

  if (error) return err('CONFLICT', error.message, 422);
  return ok({ success: true }, 200);
}
```

`PUT` supports `is_available` (the most common quick action per `feature-spec.md` §9 "Item availability toggle") and `image_url` (Task 6) — full field editing (name/price/description) follows the same pattern and is a straightforward future extension, deliberately kept minimal for this plan.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test --workspace=apps/web -- tests/api/categories-route.test.ts tests/api/menu-items-route.test.ts`
Expected: both `PASS`.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/services/menuService.ts apps/web/app/api/categories apps/web/app/api/menu-items tests/services/menuService.test.ts tests/api/categories-route.test.ts tests/api/menu-items-route.test.ts
git commit -m "feat: add menu category and item CRUD service and API routes"
```

---

### Task 3: Table CRUD service and API routes (extends staff-dashboard's tableService)

**Files:**
- Modify: `apps/web/lib/services/tableService.ts` (add `createTable`, `deleteTable`)
- Create: `apps/web/app/api/tables/route.ts`
- Create: `apps/web/app/api/tables/[tableId]/route.ts` (note: `[tableId]/release/route.ts` and `[tableId]/qr/route.ts` already exist from `staff-dashboard.md` — this adds a sibling `route.ts` for PUT/DELETE at the same `[tableId]` segment, which Next.js supports alongside nested subroutes)
- Test: `tests/services/tableService.test.ts` (extend the existing file from `staff-dashboard.md`)
- Test: `tests/api/tables-crud-route.test.ts`

**Interfaces:**
- Adds to `tableService.ts`:
  - `createTable(client, restaurantId, input: TableInput, baseUrl: string): Promise<{ id: string; qrDataUrl: string } | { error: string }>` — creates the row (DB trigger sets the placeholder `qr_code`), then immediately generates and stores the real QR data URL.
  - `deleteTable(client, tableId): Promise<{ success: true } | { error: string }>`

- [ ] **Step 1: Write the failing test additions**

Append to `tests/services/tableService.test.ts` (from `staff-dashboard.md`):

```typescript
import { createTable, deleteTable } from '../../apps/web/lib/services/tableService';

describe('tableService - CRUD', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('createTable inserts a row and populates a real QR data URL', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await createTable(
      serviceClient,
      fixture.restaurantId,
      { table_number: 99, capacity: 4, is_active: true },
      'https://example.app'
    );

    expect('id' in result).toBe(true);
    if ('id' in result) {
      expect(result.qrDataUrl).toMatch(/^data:image\/png;base64,/);

      const { data: table } = await serviceClient
        .from('tables')
        .select('qr_code')
        .eq('id', result.id)
        .single();
      expect(table!.qr_code).toMatch(/^data:image\/png;base64,/);
    }
  });

  it('createTable rejects a duplicate table_number for the same restaurant', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await createTable(
      serviceClient,
      fixture.restaurantId,
      { table_number: 1, capacity: 4, is_active: true }, // table_number 1 already seeded
      'https://example.app'
    );

    expect('error' in result).toBe(true);
  });

  it('deleteTable removes the table', async () => {
    const fixture = await seedTestData(serviceClient);
    const created = await createTable(
      serviceClient,
      fixture.restaurantId,
      { table_number: 55, capacity: 2, is_active: true },
      'https://example.app'
    );
    if (!('id' in created)) throw new Error('setup failed');

    const result = await deleteTable(serviceClient, created.id);

    expect(result).toEqual({ success: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- tests/services/tableService.test.ts`
Expected: FAIL — `createTable`/`deleteTable` not exported yet.

- [ ] **Step 3: Add createTable and deleteTable to tableService.ts**

Append to `apps/web/lib/services/tableService.ts` (which already has `releaseTable` and `getTableQrDataUrl` from `staff-dashboard.md`):

```typescript
import type { TableInput } from '@restaurant-qr/shared';

export type CreateTableResult = { id: string; qrDataUrl: string } | { error: string };
export type DeleteTableResult = { success: true } | { error: string };

export async function createTable(
  client: SupabaseClient,
  restaurantId: string,
  input: TableInput,
  baseUrl: string
): Promise<CreateTableResult> {
  const { data: table, error } = await client
    .from('tables')
    .insert({ restaurant_id: restaurantId, ...input })
    .select('id, table_number')
    .single();

  if (error || !table) {
    return { error: error?.message ?? 'Failed to create table' };
  }

  const dataUrl = await generateTableQrDataUrl(restaurantId, table.table_number, baseUrl);

  await client.from('tables').update({ qr_code: dataUrl }).eq('id', table.id);

  return { id: table.id, qrDataUrl: dataUrl };
}

export async function deleteTable(
  client: SupabaseClient,
  tableId: string
): Promise<DeleteTableResult> {
  const { error } = await client.from('tables').delete().eq('id', tableId);
  if (error) return { error: error.message };
  return { success: true };
}
```

(Move the `import type { TableInput } from '@restaurant-qr/shared';` to the top of the file alongside the existing imports, per standard module conventions — shown separately here only to mark what's new.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/services/tableService.test.ts`
Expected: `PASS` — all tests (original 4 from `staff-dashboard.md` + 3 new) green.

- [ ] **Step 5: Write failing API route test**

Create `tests/api/tables-crud-route.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

describe('POST /api/tables', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('rejects a non-positive table_number with 400', async () => {
    const fixture = await seedTestData(serviceClient);

    const response = await fetch(`${BASE_URL}/api/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: fixture.restaurantId, table_number: -1 }),
    });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Start dev server: `npm run dev --workspace=apps/web`
Run: `npm run test --workspace=apps/web -- tests/api/tables-crud-route.test.ts`
Expected: FAIL (404).

- [ ] **Step 7: Implement the route handlers**

Create `apps/web/app/api/tables/route.ts`:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { tableSchema } from '@restaurant-qr/shared';
import { createTable } from '@/lib/services/tableService';

const ALLOWED_ROLES = ['restaurant_owner', 'manager', 'super_admin'];

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json().catch(() => null);
  const restaurantId = body?.restaurant_id;
  const parsed = tableSchema.safeParse(body);

  if (!restaurantId || !parsed.success) {
    return err('VALIDATION_ERROR', parsed.success ? 'restaurant_id is required' : parsed.error.errors.map((e) => e.message).join(', '), 400);
  }

  const baseUrl = new URL(request.url).origin;
  const result = await createTable(supabase, restaurantId, parsed.data, baseUrl);
  if ('error' in result) return err('CONFLICT', result.error, 422);
  return ok(result, 201);
}
```

Create `apps/web/app/api/tables/[tableId]/route.ts`:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { deleteTable } from '@/lib/services/tableService';

const ALLOWED_ROLES = ['restaurant_owner', 'super_admin'];

export async function DELETE(
  _request: Request,
  { params }: { params: { tableId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const result = await deleteTable(supabase, params.tableId);
  if ('error' in result) return err('CONFLICT', result.error, 422);
  return ok(result, 200);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/api/tables-crud-route.test.ts`
Expected: `PASS`

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/services/tableService.ts "apps/web/app/api/tables/route.ts" "apps/web/app/api/tables/[tableId]/route.ts" tests/services/tableService.test.ts tests/api/tables-crud-route.test.ts
git commit -m "feat: add table CRUD service and API routes with QR generation on create"
```

---

### Task 4: Staff invite service and API route

**Files:**
- Create: `apps/web/lib/services/staffService.ts`
- Create: `apps/web/app/api/staff/invite/route.ts`
- Test: `tests/services/staffService.test.ts`
- Test: `tests/api/staff-invite-route.test.ts`

**Interfaces:**
- Consumes: `inviteStaffSchema` from `@restaurant-qr/shared`, `createAdminClient` from `@/lib/supabase/admin` (Task 1).
- Produces: `inviteStaff(adminClient, restaurantId, input: InviteStaffInput): Promise<{ userId: string } | { error: string }>` — calls `adminClient.auth.admin.inviteUserByEmail(email, { data: { role, restaurant_id } })`. Local dev captures the invite email via Supabase's local SMTP testing server (`http://127.0.0.1:54324`, already configured in `supabase/config.toml`'s `[local_smtp]` block).

- [ ] **Step 1: Write the failing service test**

Create `tests/services/staffService.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';
import { inviteStaff } from '../../apps/web/lib/services/staffService';

describe('staffService', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('invites a new staff member and sets role + restaurant metadata', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await inviteStaff(serviceClient, fixture.restaurantId, {
      email: 'new-waiter@test.local',
      role: 'waiter',
    });

    expect('userId' in result).toBe(true);
    if ('userId' in result) {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('role, restaurant_id')
        .eq('id', result.userId)
        .single();
      expect(profile!.role).toBe('waiter');
      expect(profile!.restaurant_id).toBe(fixture.restaurantId);
    }
  });

  it('rejects inviting a duplicate email', async () => {
    const fixture = await seedTestData(serviceClient);
    await inviteStaff(serviceClient, fixture.restaurantId, { email: 'dup@test.local', role: 'waiter' });

    const result = await inviteStaff(serviceClient, fixture.restaurantId, {
      email: 'dup@test.local',
      role: 'cashier',
    });

    expect('error' in result).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- tests/services/staffService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement staffService.ts**

Create `apps/web/lib/services/staffService.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InviteStaffInput } from '@restaurant-qr/shared';

export type InviteStaffResult = { userId: string } | { error: string };

// client must be created with the service_role key (createAdminClient) —
// inviteUserByEmail is an admin-only Supabase Auth API.
export async function inviteStaff(
  client: SupabaseClient,
  restaurantId: string,
  input: InviteStaffInput
): Promise<InviteStaffResult> {
  const { data, error } = await client.auth.admin.inviteUserByEmail(input.email, {
    data: {
      role: input.role,
      restaurant_id: restaurantId,
    },
  });

  if (error || !data.user) {
    return { error: error?.message ?? 'Failed to invite staff member' };
  }

  return { userId: data.user.id };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/services/staffService.test.ts`
Expected: `PASS`. Note: local Supabase's `[local_smtp]` config means the invite email is captured, not actually sent — visible at `http://127.0.0.1:54324` for manual verification.

- [ ] **Step 5: Write the failing API route test**

Create `tests/api/staff-invite-route.test.ts`:

```typescript
const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

describe('POST /api/staff/invite', () => {
  it('rejects an invalid role with 400', async () => {
    const response = await fetch(`${BASE_URL}/api/staff/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@test.local', role: 'super_admin' }),
    });

    // super_admin is intentionally excluded from inviteStaffSchema's role enum
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Start dev server: `npm run dev --workspace=apps/web`
Run: `npm run test --workspace=apps/web -- tests/api/staff-invite-route.test.ts`
Expected: FAIL (404).

- [ ] **Step 7: Implement the route handler**

Create `apps/web/app/api/staff/invite/route.ts`:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviteStaffSchema } from '@restaurant-qr/shared';
import { inviteStaff } from '@/lib/services/staffService';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role, restaurant_id').eq('id', user.id).single();
  if (!profile || (profile.role !== 'restaurant_owner' && profile.role !== 'super_admin') || !profile.restaurant_id) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteStaffSchema.safeParse(body);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.errors.map((e) => e.message).join(', '), 400);
  }

  const adminClient = createAdminClient();
  const result = await inviteStaff(adminClient, profile.restaurant_id, parsed.data);
  if ('error' in result) return err('CONFLICT', result.error, 422);
  return ok(result, 201);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/api/staff-invite-route.test.ts`
Expected: `PASS`

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/services/staffService.ts "apps/web/app/api/staff/invite/route.ts" tests/services/staffService.test.ts tests/api/staff-invite-route.test.ts
git commit -m "feat: add staff invite service and API route"
```

---

### Task 5: Wire the owner dashboard's three tabs to real UI (menu, tables, staff, categories)

**Files:**
- Create: `apps/web/app/(restaurant-owner)/owner/MenuManagementTab.tsx`
- Create: `apps/web/app/(restaurant-owner)/owner/TableManagementTab.tsx`
- Create: `apps/web/app/(restaurant-owner)/owner/StaffManagementTab.tsx`
- Modify: `apps/web/app/(restaurant-owner)/owner/page.tsx`

**Interfaces:**
- Each tab component takes `{ restaurantId: string }` as props and manages its own fetch/mutate/error state, calling the Task 2/3/4 API routes.
- `MenuManagementTab` includes category create/edit/delete/reorder from the start (folded in from what was a separate later task in the original combined plan).

- [ ] **Step 1: Implement MenuManagementTab.tsx**

Create `apps/web/app/(restaurant-owner)/owner/MenuManagementTab.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface MenuItemRow {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
  category_id: string;
}

interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
}

export default function MenuManagementTab({ restaurantId }: { restaurantId: string }) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supabase = createClient();

  const fetchMenu = async () => {
    const [categoriesResult, itemsResult] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, sort_order')
        .eq('restaurant_id', restaurantId)
        .order('sort_order'),
      supabase.from('menu_items').select('id, name, price, is_available, category_id').eq('restaurant_id', restaurantId),
    ]);
    if (categoriesResult.data) {
      setCategories(categoriesResult.data);
      if (categoriesResult.data.length > 0 && !newItemCategoryId) {
        setNewItemCategoryId(categoriesResult.data[0].id);
      }
    }
    if (itemsResult.data) setItems(itemsResult.data);
  };

  useEffect(() => {
    fetchMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const addCategory = async () => {
    if (!newCategoryName) return;

    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, name: newCategoryName, sort_order: categories.length }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error ?? 'Failed to add category');
      return;
    }

    setNewCategoryName('');
    setErrorMessage(null);
    fetchMenu();
  };

  const deleteCategoryHandler = async (categoryId: string) => {
    const response = await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
    if (!response.ok) {
      setErrorMessage('Failed to delete category (it may still have menu items)');
      return;
    }
    fetchMenu();
  };

  const moveCategory = async (categoryId: string, direction: -1 | 1) => {
    const index = categories.findIndex((c) => c.id === categoryId);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= categories.length) return;

    await Promise.all([
      fetch(`/api/categories/${categories[index].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: swapIndex }),
      }),
      fetch(`/api/categories/${categories[swapIndex].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: index }),
      }),
    ]);
    fetchMenu();
  };

  const addItem = async () => {
    if (!newItemName || !newItemPrice || !newItemCategoryId) return;

    const response = await fetch('/api/menu-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        name: newItemName,
        price: Number(newItemPrice),
        category_id: newItemCategoryId,
      }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error ?? 'Failed to add item');
      return;
    }

    setNewItemName('');
    setNewItemPrice('');
    setErrorMessage(null);
    fetchMenu();
  };

  const toggleAvailability = async (itemId: string, current: boolean) => {
    const response = await fetch(`/api/menu-items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: !current }),
    });

    if (!response.ok) {
      setErrorMessage('Failed to update availability');
      return;
    }
    fetchMenu();
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="p-4 border rounded-lg space-y-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium">New category</label>
            <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
          </div>
          <Button onClick={addCategory}>Add Category</Button>
        </div>
        {categories.map((cat, index) => (
          <div key={cat.id} className="flex items-center justify-between text-sm p-2 border-b last:border-0">
            <span>{cat.name}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => moveCategory(cat.id, -1)} disabled={index === 0}>
                ↑
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => moveCategory(cat.id, 1)}
                disabled={index === categories.length - 1}
              >
                ↓
              </Button>
              <Button size="sm" variant="destructive" onClick={() => deleteCategoryHandler(cat.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Add a category above before adding menu items.</p>
      ) : (
        <div className="flex gap-2 items-end p-4 border rounded-lg">
          <div className="flex-1">
            <label className="text-sm font-medium">Item name</label>
            <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
          </div>
          <div className="w-28">
            <label className="text-sm font-medium">Price</label>
            <Input type="number" step="0.01" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} />
          </div>
          <div className="w-40">
            <label className="text-sm font-medium">Category</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newItemCategoryId}
              onChange={(e) => setNewItemCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={addItem}>Add Item</Button>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <span className="font-medium">{item.name}</span>
              <span className="text-gray-500 ml-2">${Number(item.price).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={item.is_available ? 'default' : 'outline'}>
                {item.is_available ? 'Available' : 'Unavailable'}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => toggleAvailability(item.id, item.is_available)}>
                Toggle
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

(Task 6 below adds an image-upload control per item to this same component.)

- [ ] **Step 2: Implement TableManagementTab.tsx**

Create `apps/web/app/(restaurant-owner)/owner/TableManagementTab.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TableRow {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
}

export default function TableManagementTab({ restaurantId }: { restaurantId: string }) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supabase = createClient();

  const fetchTables = async () => {
    const { data } = await supabase
      .from('tables')
      .select('id, table_number, capacity, status')
      .eq('restaurant_id', restaurantId)
      .order('table_number', { ascending: true });
    if (data) setTables(data);
  };

  useEffect(() => {
    fetchTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const addTable = async () => {
    if (!newTableNumber) return;

    const response = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        table_number: Number(newTableNumber),
        capacity: Number(newTableCapacity),
      }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error ?? 'Failed to add table');
      return;
    }

    setNewTableNumber('');
    setErrorMessage(null);
    fetchTables();
  };

  const removeTable = async (tableId: string) => {
    const response = await fetch(`/api/tables/${tableId}`, { method: 'DELETE' });
    if (!response.ok) {
      setErrorMessage('Failed to delete table');
      return;
    }
    fetchTables();
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-2 items-end p-4 border rounded-lg">
        <div className="w-32">
          <label className="text-sm font-medium">Table number</label>
          <Input type="number" value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} />
        </div>
        <div className="w-32">
          <label className="text-sm font-medium">Capacity</label>
          <Input type="number" value={newTableCapacity} onChange={(e) => setNewTableCapacity(e.target.value)} />
        </div>
        <Button onClick={addTable}>Add Table</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tables.map((table) => (
          <div key={table.id} className="p-3 border rounded-lg text-center">
            <div className="text-xl font-bold">{table.table_number}</div>
            <Badge className="mt-1">{table.status}</Badge>
            <Button
              size="sm"
              variant="destructive"
              className="w-full mt-2"
              onClick={() => removeTable(table.id)}
              disabled={table.status !== 'AVAILABLE'}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement StaffManagementTab.tsx**

Create `apps/web/app/(restaurant-owner)/owner/StaffManagementTab.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface StaffRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

const INVITABLE_ROLES = ['manager', 'kitchen_staff', 'waiter', 'cashier'] as const;

export default function StaffManagementTab({ restaurantId }: { restaurantId: string }) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<(typeof INVITABLE_ROLES)[number]>('waiter');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const supabase = createClient();

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('restaurant_id', restaurantId)
      .neq('role', 'customer');
    if (data) setStaff(data);
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const sendInvite = async () => {
    if (!inviteEmail) return;

    const response = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error ?? 'Failed to send invite');
      setSuccessMessage(null);
      return;
    }

    setInviteEmail('');
    setErrorMessage(null);
    setSuccessMessage(`Invite sent to ${inviteEmail}`);
    fetchStaff();
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md" role="alert">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-3 text-sm text-green-700 bg-green-50 rounded-md" role="status">
          {successMessage}
        </div>
      )}

      <div className="flex gap-2 items-end p-4 border rounded-lg">
        <div className="flex-1">
          <label className="text-sm font-medium">Email</label>
          <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
        </div>
        <div className="w-40">
          <label className="text-sm font-medium">Role</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as (typeof INVITABLE_ROLES)[number])}
          >
            {INVITABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={sendInvite}>Invite Staff</Button>
      </div>

      <div className="space-y-2">
        {staff.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <span className="font-medium">{member.full_name || member.email}</span>
              <span className="text-gray-500 text-sm ml-2">{member.email}</span>
            </div>
            <Badge>{member.role.replace('_', ' ')}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire the tabs into page.tsx**

In `apps/web/app/(restaurant-owner)/owner/page.tsx`, add imports:

```typescript
import MenuManagementTab from './MenuManagementTab';
import TableManagementTab from './TableManagementTab';
import StaffManagementTab from './StaffManagementTab';
```

Store `restaurant_id` (already fetched as `profile.restaurant_id` inside the effect, but not persisted to state). Hoist `fetchData` out of the `useEffect` to component scope (needed by Task 6's logo upload too). Add:

```typescript
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
```

Inside `fetchData`, after `if (!profile?.restaurant_id) return;`, add:

```typescript
      setRestaurantId(profile.restaurant_id);
```

Replace the three placeholder `<TabsContent>` bodies. The Menu Management one:

```tsx
          <TabsContent value="menu">
            <Card>
              <CardHeader>
                <CardTitle>Menu Items</CardTitle>
              </CardHeader>
              <CardContent>
                {restaurantId && <MenuManagementTab restaurantId={restaurantId} />}
              </CardContent>
            </Card>
          </TabsContent>
```

Table Management:

```tsx
          <TabsContent value="tables">
            <Card>
              <CardHeader>
                <CardTitle>Tables</CardTitle>
              </CardHeader>
              <CardContent>
                {restaurantId && <TableManagementTab restaurantId={restaurantId} />}
              </CardContent>
            </Card>
          </TabsContent>
```

Staff Management:

```tsx
          <TabsContent value="staff">
            <Card>
              <CardHeader>
                <CardTitle>Staff Members</CardTitle>
              </CardHeader>
              <CardContent>
                {restaurantId && <StaffManagementTab restaurantId={restaurantId} />}
              </CardContent>
            </Card>
          </TabsContent>
```

Remove the now-redundant per-tab "Add Item"/"Add Table"/"Invite Staff" header buttons (lines with `<Button size="sm"><Plus .../>...` in each `CardHeader`) since each tab component now owns its own add-form inline.

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev --workspace=apps/web` with local Supabase running.
Navigate to `/owner` as a seeded `restaurant_owner`. Confirm: Menu tab lets you add a category, reorder it, add an item under it, and toggle availability; Tables tab lets you add a table (confirm a QR is generated — check via Supabase Studio that `qr_code` is a real data URL, not `pending:...`) and delete an available one; Staff tab sends an invite (check `http://127.0.0.1:54324` for the captured email) and the new profile eventually appears in the list once the invited user accepts (out of scope to fully test without completing signup).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(restaurant-owner)/owner"
git commit -m "feat: wire owner dashboard menu, table, and staff management tabs with category CRUD"
```

---

### Task 6: Logo and menu item image upload

**Files:**
- Create: `apps/web/app/api/uploads/route.ts`
- Modify: `apps/web/app/(restaurant-owner)/owner/page.tsx` — add logo upload to the header
- Modify: `apps/web/app/(restaurant-owner)/owner/MenuManagementTab.tsx` — add image upload per menu item
- Test: `tests/api/uploads-route.test.ts`

**Interfaces:**
- Produces: `POST /api/uploads` accepting `multipart/form-data` with fields `file`, `bucket` (`'restaurant-logos' | 'menu-images'`), `restaurantId` → `200 { publicUrl: string }`. Uploads to the path `{restaurantId}/{timestamp}-{filename}` inside the given bucket, matching the path-prefix convention the storage RLS policies in `db-schema.md` Task 7 require (`(storage.foldername(name))[1] = restaurant_id`).
- Consumes: `PUT /api/restaurants/[restaurantId]` from the sibling `restaurant-management.md` plan, which already accepts a `logo_url` field for this exact use — see that plan's Task 1 note.

- [ ] **Step 1: Write the failing test**

Create `tests/api/uploads-route.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

describe('POST /api/uploads', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('rejects an invalid bucket name with 400', async () => {
    const fixture = await seedTestData(serviceClient);
    const formData = new FormData();
    formData.append('file', new Blob(['fake-bytes'], { type: 'image/png' }), 'logo.png');
    formData.append('bucket', 'not-a-real-bucket');
    formData.append('restaurantId', fixture.restaurantId);

    const response = await fetch(`${BASE_URL}/api/uploads`, { method: 'POST', body: formData });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Start dev server: `npm run dev --workspace=apps/web`
Run: `npm run test --workspace=apps/web -- tests/api/uploads-route.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implement the route handler**

Create `apps/web/app/api/uploads/route.ts`:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_BUCKETS = ['restaurant-logos', 'menu-images'] as const;
const ALLOWED_ROLES = ['restaurant_owner', 'manager', 'super_admin'];

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const bucket = formData?.get('bucket');
  const restaurantId = formData?.get('restaurantId');

  if (
    !(file instanceof Blob) ||
    typeof bucket !== 'string' ||
    !ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number]) ||
    typeof restaurantId !== 'string'
  ) {
    return err('VALIDATION_ERROR', 'file, a valid bucket, and restaurantId are required', 400);
  }

  const filename = file instanceof File ? file.name : 'upload';
  const path = `${restaurantId}/${Date.now()}-${filename}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
  });

  if (uploadError) {
    return err('CONFLICT', uploadError.message, 422);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  return ok({ publicUrl: data.publicUrl }, 200);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/api/uploads-route.test.ts`
Expected: `PASS`

- [ ] **Step 5: Add logo upload to the owner dashboard header**

In `apps/web/app/(restaurant-owner)/owner/page.tsx`, replace the inert `<Button><Settings .../>Settings</Button>` with a file input triggered by that button, plus logic to upload and persist the URL:

```typescript
  const uploadLogo = async (file: File) => {
    if (!restaurantId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'restaurant-logos');
    formData.append('restaurantId', restaurantId);

    const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: formData });
    if (!uploadResponse.ok) return;

    const { publicUrl } = await uploadResponse.json();

    await fetch(`/api/restaurants/${restaurantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: publicUrl }),
    });

    fetchData();
  };
```

This calls `PUT /api/restaurants/[restaurantId]` from the sibling `restaurant-management.md` plan — that plan must be complete (or its `restaurantService.ts`/route stubbed) before this step can be manually verified end-to-end. The route accepts `logo_url` in its request body per that plan's Task 1.

Replace the header `<Button>` with:

```tsx
          <label className="inline-flex">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            />
            <span className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer">
              Upload Logo
            </span>
          </label>
```

`fetchData` must already be hoisted to component scope from Task 5's restructuring — reuse it here.

- [ ] **Step 6: Add image upload to MenuManagementTab per item**

In `apps/web/app/(restaurant-owner)/owner/MenuManagementTab.tsx`, add an upload handler:

```typescript
  const uploadItemImage = async (itemId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'menu-images');
    formData.append('restaurantId', restaurantId);

    const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: formData });
    if (!uploadResponse.ok) {
      setErrorMessage('Failed to upload image');
      return;
    }

    const { publicUrl } = await uploadResponse.json();

    const updateResponse = await fetch(`/api/menu-items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: publicUrl }),
    });

    if (!updateResponse.ok) {
      setErrorMessage('Failed to save image URL');
      return;
    }

    fetchMenu();
  };
```

`PUT /api/menu-items/[menuItemId]` from Task 2 already accepts `image_url` — no changes needed there.

Add a file input next to each item's Toggle button in `MenuManagementTab.tsx`:

```tsx
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadItemImage(item.id, e.target.files[0])}
                />
                <span className="text-xs underline cursor-pointer text-blue-600">Upload image</span>
              </label>
```

- [ ] **Step 7: Manually verify in the browser**

Run: `npm run dev --workspace=apps/web` with local Supabase running.
Navigate to `/owner`. Confirm: "Upload Logo" in the header uploads and persists `restaurants.logo_url`; uploading a menu item image persists `menu_items.image_url`. Then visit the customer menu page (`/{restaurantId}/{tableNumber}`) and confirm both the restaurant logo and menu item images appear (Task 7 adds the logo render there).

- [ ] **Step 8: Run full test suite**

Run: `npm run test --workspace=apps/web -- tests/db tests/services tests/api tests/hooks`
Expected: all PASS, no regressions.

- [ ] **Step 9: Commit**

```bash
git add "apps/web/app/api/uploads/route.ts" "apps/web/app/(restaurant-owner)/owner"
git commit -m "feat: add restaurant logo and menu item image upload"
```

---

### Task 7: Render restaurant logo on the customer menu page

**Files:**
- Modify: `apps/web/app/(customer)/[restaurantId]/[tableNumber]/page.tsx`

**Interfaces:**
- No new exports; a small UI addition closing `feature-spec.md` §10's "Restaurant logo displayed prominently on customer menu" requirement, now that Task 6 makes `logo_url` settable.

- [ ] **Step 1: Add the logo render**

In `apps/web/app/(customer)/[restaurantId]/[tableNumber]/page.tsx`, inside the header's `<div><h1>{restaurant.name}</h1>...</div>` block, add:

```tsx
              {restaurant.logo_url && (
                <img src={restaurant.logo_url} alt={`${restaurant.name} logo`} className="h-8 w-8 rounded object-cover inline-block mr-2" />
              )}
```

Place it immediately before the `<h1>` so it renders to the left of the restaurant name.

- [ ] **Step 2: Manually verify**

With a restaurant that has a logo uploaded via Task 6, visit `/{restaurantId}/{tableNumber}` and confirm the logo renders next to the restaurant name.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(customer)/[restaurantId]/[tableNumber]/page.tsx"
git commit -m "feat: render restaurant logo on customer menu page"
```

---

## Definition of Done for this plan

- [ ] Owner dashboard's Menu, Table, and Staff Management tabs are fully functional (no "coming soon" text remains).
- [ ] Owner can create, edit, delete, and reorder menu categories from the UI (no longer requires Supabase Studio).
- [ ] Owner can upload a restaurant logo and menu item images; both appear on the customer-facing menu.
- [ ] Tables created via the owner UI get a real QR code data URL, not the `'pending:...'` placeholder.
- [ ] Owner can invite staff; invited users receive role + restaurant_id via `user_metadata`, consumed by the existing `handle_new_user()` trigger.
- [ ] All new API routes enforce role checks matching `feature-spec.md` §11's permission matrix, verified by tests.
- [ ] `packages/shared/src/validators`' `categorySchema`, `menuItemSchema`, `tableSchema`, `inviteStaffSchema` are now actually used by the app (previously dead code per the audit).
- [ ] Known follow-up (not in scope): full menu item field editing beyond availability toggle and image (name/price/description edit) is deferred.
- [ ] Known follow-up (not in scope): sales reports beyond the existing basic today's-stats (date-range filters, CSV/PDF export) are a genuinely separate feature area and are not part of this plan set.
