# Staff Dashboard Gap-Closing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the dead "Process Payment" button to the cashier flow, add manual table release (via the existing `release_table()` function), add per-table QR code download, replace the manual Realtime subscription with the polling-fallback hook, and add error handling.

**Architecture:** `apps/web/app/(staff)/staff/page.tsx` currently fetches tables/orders unscoped by restaurant (relying on RLS) and has a no-op payment button. This plan adds `POST /api/tables/[tableId]/release` (wraps `release_table()`), a `GET /api/tables/[tableId]/qr` route that returns a fresh QR data URL, and fixes the dead button by linking to `/cashier?order={orderId}`.

**Tech Stack:** Next.js Route Handlers, `@restaurant-qr/shared`'s `generateTableQrDataUrl` (from `db-schema.md`), existing `release_table()` Postgres function, `useRealtimeWithPolling` hook (from `kitchen-dashboard.md`).

**Depends on:** `2026-07-08-test-infrastructure.md`, `2026-07-08-db-schema.md`, `2026-07-09-kitchen-dashboard.md` (for `useRealtimeWithPolling` and the shared `ok()`/`err()` response envelope in `packages/shared/src/http/apiResponse.ts`) must be complete.

## Global Constraints

- Handlers stay thin; atomic operations stay in Postgres functions (per `CLAUDE.md`).
- Every mutation is permission-checked at three layers: RLS, API route, UI (per `CLAUDE.md`). Per `feature-spec.md`'s permission matrix, `release_table` / table status updates are Waiter/Manager/Owner/Super Admin only — Cashier and Kitchen must be excluded at the API layer even though RLS may be more permissive for some columns.
- All API route handlers return responses via `ok()`/`err()` from `packages/shared/src/http/apiResponse.ts` (established in `kitchen-dashboard.md`) — never call `NextResponse.json(...)` directly.
- Realtime subscriptions always include a polling fallback (per `CLAUDE.md`).
- TypeScript strict mode; no `any` without a comment explaining why (per `CLAUDE.md`).
- Table status flow: `AVAILABLE → OCCUPIED → WAITING_PAYMENT → AVAILABLE`, with `CLEANING` as a branch from `WAITING_PAYMENT` (per `feature-spec.md` §5, `CLAUDE.md`). Note the existing UI only implements `AVAILABLE ↔ CLEANING`, not the full flow — this plan does not change table-status transition UI beyond what's specified below; `OCCUPIED`/`WAITING_PAYMENT` transitions happen automatically via `create_order_with_session()`/`process_payment()`, not manual staff buttons.

---

## File Structure

```
restaurant-qr-order/
├── apps/web/
│   ├── app/
│   │   ├── api/
│   │   │   └── tables/
│   │   │       └── [tableId]/
│   │   │           ├── release/
│   │   │           │   └── route.ts       # NEW — POST: release_table wrapper
│   │   │           └── qr/
│   │   │               └── route.ts       # NEW — GET: fresh QR data URL
│   │   └── (staff)/staff/
│   │       └── page.tsx                   # MODIFY — fix payment button, add release + QR download, polling
│   └── lib/
│       └── services/
│           └── tableService.ts            # NEW — releaseTable, getTableQrDataUrl
└── tests/
    ├── services/
    │   └── tableService.test.ts           # NEW
    └── api/
        ├── tables-release-route.test.ts   # NEW
        └── tables-qr-route.test.ts        # NEW
```

**Responsibilities:**
- `tableService.ts` — the one place that calls `release_table()` RPC and generates QR data URLs for a table. Consumed by the two new route handlers here, and later by `owner-and-admin.md`'s table management UI (which will also need release + QR generation).

---

### Task 1: Table service — release and QR generation

**Files:**
- Create: `apps/web/lib/services/tableService.ts`
- Test: `tests/services/tableService.test.ts`

**Interfaces:**
- Consumes: `generateTableQrDataUrl` from `@restaurant-qr/shared` (built in `db-schema.md` Task 8).
- Produces:
  - `releaseTable(client: SupabaseClient, tableId: string): Promise<{ success: true } | { error: string }>`
  - `getTableQrDataUrl(client: SupabaseClient, tableId: string, baseUrl: string): Promise<{ dataUrl: string } | { error: string }>`

  Both consumed by this plan's route handlers; both will be reused by `owner-and-admin.md`.

- [ ] **Step 1: Write the failing test**

Create `tests/services/tableService.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';
import { releaseTable, getTableQrDataUrl } from '../../apps/web/lib/services/tableService';

describe('tableService', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('releaseTable cancels unpaid orders and frees the table', async () => {
    const fixture = await seedTestData(serviceClient);
    await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });

    const result = await releaseTable(serviceClient, fixture.tableId);

    expect(result).toEqual({ success: true });

    const { data: table } = await serviceClient
      .from('tables')
      .select('status')
      .eq('id', fixture.tableId)
      .single();
    expect(table!.status).toBe('AVAILABLE');
  });

  it('releaseTable returns an error when no active session exists', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await releaseTable(serviceClient, fixture.tableId);

    expect('error' in result).toBe(true);
  });

  it('getTableQrDataUrl returns a base64 PNG data URL', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await getTableQrDataUrl(serviceClient, fixture.tableId, 'https://example.app');

    expect('dataUrl' in result).toBe(true);
    if ('dataUrl' in result) {
      expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    }
  });

  it('getTableQrDataUrl returns an error for a nonexistent table', async () => {
    const result = await getTableQrDataUrl(
      serviceClient,
      '00000000-0000-0000-0000-000000000000',
      'https://example.app'
    );

    expect('error' in result).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- tests/services/tableService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement tableService.ts**

Create `apps/web/lib/services/tableService.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTableQrDataUrl } from '@restaurant-qr/shared';

export type ReleaseTableResult = { success: true } | { error: string };
export type GetTableQrResult = { dataUrl: string } | { error: string };

export async function releaseTable(
  client: SupabaseClient,
  tableId: string
): Promise<ReleaseTableResult> {
  const { error } = await client.rpc('release_table', { p_table_id: tableId });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function getTableQrDataUrl(
  client: SupabaseClient,
  tableId: string,
  baseUrl: string
): Promise<GetTableQrResult> {
  const { data: table, error } = await client
    .from('tables')
    .select('restaurant_id, table_number')
    .eq('id', tableId)
    .single();

  if (error || !table) {
    return { error: error?.message ?? 'Table not found' };
  }

  const dataUrl = await generateTableQrDataUrl(table.restaurant_id, table.table_number, baseUrl);
  return { dataUrl };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/services/tableService.test.ts`
Expected: `PASS` — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/services/tableService.ts tests/services/tableService.test.ts
git commit -m "feat: add table service for release and QR generation"
```

---

### Task 2: API routes — release and QR

**Files:**
- Create: `apps/web/app/api/tables/[tableId]/release/route.ts`
- Create: `apps/web/app/api/tables/[tableId]/qr/route.ts`
- Test: `tests/api/tables-release-route.test.ts`
- Test: `tests/api/tables-qr-route.test.ts`

**Interfaces:**
- Produces: `POST /api/tables/:tableId/release` → `200 { success: true }` / `403` for non-staff roles / `422` on service error. `GET /api/tables/:tableId/qr` → `200 { dataUrl: string }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/api/tables-release-route.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

describe('POST /api/tables/[tableId]/release', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('returns 422 when no active session exists', async () => {
    const fixture = await seedTestData(serviceClient);

    const response = await fetch(`${BASE_URL}/api/tables/${fixture.tableId}/release`, {
      method: 'POST',
    });

    expect(response.status).toBe(422);
  });
});
```

Create `tests/api/tables-qr-route.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

describe('GET /api/tables/[tableId]/qr', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('returns a data URL for a valid table', async () => {
    const fixture = await seedTestData(serviceClient);

    const response = await fetch(`${BASE_URL}/api/tables/${fixture.tableId}/qr`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('returns 404 for a nonexistent table', async () => {
    const response = await fetch(
      `${BASE_URL}/api/tables/00000000-0000-0000-0000-000000000000/qr`
    );

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Start dev server: `npm run dev --workspace=apps/web`
Run: `npm run test --workspace=apps/web -- tests/api/tables-release-route.test.ts tests/api/tables-qr-route.test.ts`
Expected: both FAIL with 404s (routes don't exist).

- [ ] **Step 3: Implement the release route**

Create `apps/web/app/api/tables/[tableId]/release/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { releaseTable } from '@/lib/services/tableService';

const ALLOWED_ROLES = ['waiter', 'manager', 'restaurant_owner', 'super_admin'];

export async function POST(
  _request: Request,
  { params }: { params: { tableId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const result = await releaseTable(supabase, params.tableId);

  if ('error' in result) {
    return err('CONFLICT', result.error, 422);
  }

  return ok(result, 200);
}
```

- [ ] **Step 4: Implement the QR route**

Create `apps/web/app/api/tables/[tableId]/qr/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { getTableQrDataUrl } from '@/lib/services/tableService';

export async function GET(
  request: Request,
  { params }: { params: { tableId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const baseUrl = new URL(request.url).origin;
  const result = await getTableQrDataUrl(supabase, params.tableId, baseUrl);

  if ('error' in result) {
    return err('NOT_FOUND', result.error, 404);
  }

  return ok(result, 200);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test --workspace=apps/web -- tests/api/tables-release-route.test.ts tests/api/tables-qr-route.test.ts`
Expected: both `PASS`.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/api/tables/[tableId]/release/route.ts" "apps/web/app/api/tables/[tableId]/qr/route.ts" tests/api/tables-release-route.test.ts tests/api/tables-qr-route.test.ts
git commit -m "feat: add table release and QR code API routes"
```

---

### Task 3: Wire the staff dashboard UI

**Files:**
- Modify: `apps/web/app/(staff)/staff/page.tsx`

**Interfaces:**
- Consumes: `useRealtimeWithPolling` (from `kitchen-dashboard.md`), `POST /api/tables/[tableId]/release`, `GET /api/tables/[tableId]/qr`.

- [ ] **Step 1: Fix the "Process Payment" button**

Import `Link` from `next/link` at the top of the file. Replace:

```tsx
                        <Button size="sm">Process Payment</Button>
```

with:

```tsx
                        <Link href={`/cashier?order=${order.id}`}>
                          <Button size="sm">Process Payment</Button>
                        </Link>
```

This routes to the cashier dashboard with the order preselected — the cashier dashboard's query-param handling for `?order=` is out of scope for this plan (it's a `payments-and-cashier.md` concern); note that dependency there.

- [ ] **Step 2: Add "Release Table" action and error state**

Add near the top of the component:

```typescript
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
```

Add a `releaseTable` function alongside the existing `updateTableStatus`:

```typescript
  const releaseTable = async (tableId: string) => {
    const response = await fetch(`/api/tables/${tableId}/release`, { method: 'POST' });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error ?? 'Failed to release table');
      return;
    }

    setErrorMessage(null);
    fetchData();
  };
```

`fetchData` must be hoisted out of the mount-only `useEffect` to be callable here — apply the same restructuring as `kitchen-dashboard.md` Task 4 Step 4 (move `fetchData` to component scope, keep a `useEffect(() => { fetchData(); }, [])` for the initial load).

Add the release button inside the Tables tab's per-table card, after the existing `AVAILABLE`/`CLEANING` conditional buttons:

```tsx
                      {(table.status === 'OCCUPIED' || table.status === 'WAITING_PAYMENT') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="mt-2 w-full"
                          onClick={() => releaseTable(table.id)}
                        >
                          Release Table
                        </Button>
                      )}
```

- [ ] **Step 3: Add QR download button**

Add a `downloadQr` function:

```typescript
  const downloadQr = async (tableId: string, tableNumber: number) => {
    const response = await fetch(`/api/tables/${tableId}/qr`);

    if (!response.ok) {
      setErrorMessage('Failed to generate QR code');
      return;
    }

    const { dataUrl } = await response.json();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `table-${tableNumber}-qr.png`;
    link.click();
  };
```

Add a QR download button in the same table card, after the Release Table button:

```tsx
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => downloadQr(table.id, table.table_number)}
                      >
                        Download QR
                      </Button>
```

- [ ] **Step 4: Add error display**

After the `<h1>` header block, before the `<Tabs>` component:

```tsx
        {errorMessage && (
          <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 rounded-md" role="alert">
            {errorMessage}
          </div>
        )}
```

- [ ] **Step 5: Replace manual Realtime subscription with the polling-fallback hook**

Remove the existing `useEffect` block containing `supabase.channel('staff-updates')...`. Add:

```typescript
  useRealtimeWithPolling({
    channelName: 'staff-tables',
    table: 'tables',
    onChange: fetchData,
  });

  useRealtimeWithPolling({
    channelName: 'staff-orders',
    table: 'orders',
    onChange: fetchData,
  });
```

Import `useRealtimeWithPolling` from `@/hooks/useRealtimeWithPolling`.

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev --workspace=apps/web` with local Supabase running.
Navigate to `/staff` as a seeded `waiter`. Confirm: Tables tab shows Release Table on occupied tables and it clears the table via the API route; Download QR produces a downloaded PNG; Waiting Payment tab's Process Payment button navigates to `/cashier?order=...`.

- [ ] **Step 7: Run full test suite**

Run: `npm run test --workspace=apps/web -- tests/db tests/services tests/api tests/hooks`
Expected: all PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/(staff)/staff/page.tsx"
git commit -m "fix: wire staff dashboard payment button, add table release and QR download"
```

---

## Definition of Done for this plan

- [ ] "Process Payment" button navigates to the cashier flow instead of doing nothing.
- [ ] Staff can release a table (cancels unpaid orders, frees table) via a real button calling `release_table()`.
- [ ] Staff can download a table's QR code as a PNG.
- [ ] Staff dashboard recovers from a dropped Realtime connection via polling fallback.
- [ ] Errors are shown to the user, not silently swallowed.
- [ ] `tests/services/tableService.test.ts`, `tests/api/tables-release-route.test.ts`, `tests/api/tables-qr-route.test.ts` all pass.
