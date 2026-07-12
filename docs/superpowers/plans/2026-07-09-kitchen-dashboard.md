# Kitchen Dashboard Gap-Closing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the kitchen dashboard's correctness bug (direct `orders.status` mutation bypassing the `update_order_status()` Postgres function) by introducing the first API route handler in the codebase, then close the remaining feature-spec gaps: reject-order action, Realtime polling fallback, and user-visible error handling.

**Architecture:** `apps/web/app/(kitchen)/kitchen/page.tsx` currently calls `supabase.from('orders').update({ status })` directly from the client. This plan adds `POST /api/orders/[orderId]/status`, a thin Next.js Route Handler that validates input with Zod and calls `update_order_status()` via a server-side Supabase client — establishing the mutation-goes-through-API pattern that later plans (staff, payments, owner) will reuse. Reads stay direct client→Supabase, protected by existing RLS.

**Tech Stack:** Next.js Route Handlers, Zod (`packages/shared/src/validators`), `@supabase/ssr` server client, existing `update_order_status()` Postgres function.

**Depends on:** `2026-07-08-test-infrastructure.md` and `2026-07-08-db-schema.md` must be complete.

## Global Constraints

- Handlers stay thin: route handlers validate input (Zod) and call a service function or DB function — no business logic, no direct multi-table writes in the handler itself (per `CLAUDE.md`).
- Atomic operations stay in Postgres functions, not application code — never reimplement `update_order_status()`'s transition logic in JS (per `CLAUDE.md`).
- Every mutation is permission-checked at three layers: RLS policy (DB), route handler (API), and conditional rendering (UI) (per `CLAUDE.md`). Permission matrix per `feature-spec.md` §11: "Update order status" is Kitchen Staff / Manager / Owner / Super Admin only — Waiter and Cashier must be excluded at the API layer.
- All API route handlers return responses via `ok()`/`err()` from `packages/shared/src/http/apiResponse.ts` (Task 1 below) — never call `NextResponse.json(...)` directly. This is the first plan to add a route handler, so this file is where that convention starts.
- Realtime subscriptions always include a polling fallback per the spec's cross-cutting requirements (per `CLAUDE.md` and `feature-spec.md`).
- TypeScript strict mode everywhere; no `any` without a comment explaining why (per `CLAUDE.md`).
- Order status flow: `PENDING → ACCEPTED → PREPARING → READY → COMPLETED`, `CANCELLED` reachable from any pre-COMPLETED state, enforced at the DB layer via `update_order_status()` (per `feature-spec.md` §3 and the existing migration).

---

## File Structure

```
restaurant-qr-order/
├── apps/web/
│   ├── app/
│   │   ├── api/
│   │   │   └── orders/
│   │   │       └── [orderId]/
│   │   │           └── status/
│   │   │               └── route.ts       # NEW — POST: update_order_status wrapper
│   │   └── (kitchen)/kitchen/
│   │       └── page.tsx                   # MODIFY — call API route, add reject button, polling fallback
│   ├── lib/
│   │   └── services/
│   │       └── orderStatusService.ts      # NEW — thin service wrapping the RPC call
│   └── hooks/
│       └── useRealtimeWithPolling.ts      # NEW — reusable Realtime + polling fallback hook
├── packages/shared/src/http/
│   └── apiResponse.ts                     # NEW — shared success/error envelope for ALL API routes
└── tests/
    ├── api/
    │   └── orders-status-route.test.ts    # NEW — integration test for the route handler
    ├── http/
    │   └── apiResponse.test.ts            # NEW
    └── hooks/
        └── useRealtimeWithPolling.test.tsx # NEW
```

**Responsibilities:**
- `apiResponse.ts` — this is the first plan to introduce an API route in the codebase, so it's also where the response envelope gets decided, once, for every plan that copies this pattern afterward (staff, payments, owner-admin). Without this, each later plan invents its own `{ error: string }` shape ad hoc and they drift.
- `orderStatusService.ts` — the one place that calls `supabase.rpc('update_order_status', ...)`. The route handler calls this; nothing else should call the RPC directly, so later plans (staff dashboard, which also touches order status) import this service instead of duplicating the RPC call.
- `useRealtimeWithPolling.ts` — generic hook: subscribes to a Realtime channel, and if no event arrives within a configurable interval, falls back to polling. This is the first of several dashboards that need this pattern (kitchen, staff, cashier, manager all have Realtime-only subscriptions per the audit) — built once here, reused by later plans.
- `app/api/orders/[orderId]/status/route.ts` — validates `{ status }` body with Zod against `updateOrderStatusSchema` (already defined in `packages/shared/src/validators/index.ts`), calls the service, returns the updated status or a structured error via `ok()` / `err()`.

---

### Task 1: Shared API response envelope

**Files:**
- Create: `packages/shared/src/http/apiResponse.ts`
- Test: `tests/http/apiResponse.test.ts`

**Interfaces:**
- Produces: `ok<T>(data: T, status?: number)` → `NextResponse` with body `{ data: T }`; `err(code: ErrorCode, message: string, status: number, details?: unknown)` → `NextResponse` with body `{ error: { code, message, details? } }`. Both consumed by every route handler in this plan and every plan after it (staff, payments, owner-admin).
- `ErrorCode` union: `'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR'`. Status-code convention: `401` → `UNAUTHORIZED`, `403` → `FORBIDDEN`, `400` → `VALIDATION_ERROR`, `404` → `NOT_FOUND`, `409`/`422` → `CONFLICT` (business-rule violations — invalid status transition, unpaid session, etc.), `500` → `INTERNAL_ERROR`.

This exists so the client side (hooks, toast handling) can branch on `error.code` instead of matching on `error.message` strings, and so every success response has one consistent shape (`{ data }`) instead of each route returning a differently-shaped raw object.

- [ ] **Step 1: Write the failing test**

Create `tests/http/apiResponse.test.ts`:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';

describe('apiResponse', () => {
  it('ok() wraps data in a { data } envelope with default status 200', async () => {
    const res = ok({ id: '1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { id: '1' } });
  });

  it('ok() respects an explicit status', async () => {
    const res = ok({ id: '1' }, 201);
    expect(res.status).toBe(201);
  });

  it('err() wraps code/message/details in an { error } envelope', async () => {
    const res = err('VALIDATION_ERROR', 'name is required', 400, { field: 'name' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'name is required', details: { field: 'name' } },
    });
  });

  it('err() omits details when not provided', async () => {
    const res = err('UNAUTHORIZED', 'Unauthorized', 401);
    const body = await res.json();
    expect(body.error.details).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/http/apiResponse.test.ts --config apps/web/jest.config.ts`
Expected: FAIL — module `@restaurant-qr/shared/http/apiResponse` doesn't exist yet.

- [ ] **Step 3: Implement the helper**

Create `packages/shared/src/http/apiResponse.ts`:

```typescript
import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function err(code: ErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, { status });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/http/apiResponse.test.ts --config apps/web/jest.config.ts`
Expected: PASS — 4/4.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/http/apiResponse.ts tests/http/apiResponse.test.ts
git commit -m "feat: add standardized ok/err API response envelope for all route handlers"
```

---

### Task 2: Order status service function

**Files:**
- Create: `apps/web/lib/services/orderStatusService.ts`
- Test: `tests/services/orderStatusService.test.ts`

**Interfaces:**
- Consumes: a server-side `SupabaseClient` (from `@/lib/supabase/server`), `OrderStatus` type from `@restaurant-qr/shared`.
- Produces: `updateOrderStatus(client: SupabaseClient, orderId: string, newStatus: OrderStatus): Promise<{ status: OrderStatus } | { error: string }>` — consumed by the Task 3 route handler and, later, by the staff-dashboard plan.

- [ ] **Step 1: Write the failing test**

Create `tests/services/orderStatusService.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';
import { updateOrderStatus } from '../../apps/web/lib/services/orderStatusService';

describe('updateOrderStatus service', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('advances a PENDING order to ACCEPTED', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
      .select()
      .single();

    const result = await updateOrderStatus(serviceClient, order!.id, 'ACCEPTED');

    expect(result).toEqual({ status: 'ACCEPTED' });
  });

  it('returns an error object for an invalid transition instead of throwing', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
      .select()
      .single();

    const result = await updateOrderStatus(serviceClient, order!.id, 'READY');

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/Invalid status transition/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- tests/services/orderStatusService.test.ts`
Expected: FAIL with "Cannot find module '../../apps/web/lib/services/orderStatusService'"

- [ ] **Step 3: Implement the service**

Create `apps/web/lib/services/orderStatusService.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderStatus } from '@restaurant-qr/shared';

export type UpdateOrderStatusResult = { status: OrderStatus } | { error: string };

export async function updateOrderStatus(
  client: SupabaseClient,
  orderId: string,
  newStatus: OrderStatus
): Promise<UpdateOrderStatusResult> {
  const { data, error } = await client.rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
  });

  if (error) {
    return { error: error.message };
  }

  return { status: data as OrderStatus };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/services/orderStatusService.test.ts`
Expected: `PASS` — both tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/services/orderStatusService.ts tests/services/orderStatusService.test.ts
git commit -m "feat: add order status service wrapping update_order_status RPC"
```

---

### Task 3: API route handler for order status updates

**Files:**
- Create: `apps/web/app/api/orders/[orderId]/status/route.ts`
- Test: `tests/api/orders-status-route.test.ts`

**Interfaces:**
- Consumes: `updateOrderStatusSchema` from `@restaurant-qr/shared` (already exists: `z.object({ status: z.enum([...]) })`), `updateOrderStatus` service from Task 2, `ok`/`err` from Task 1's `apiResponse.ts`, `createClient` from `@/lib/supabase/server`.
- Produces: `POST /api/orders/:orderId/status` with body `{ status: OrderStatus }` → `200 { data: { status: OrderStatus } }` on success, `400 { error: { code: 'VALIDATION_ERROR', message } }` on validation failure, `422 { error: { code: 'CONFLICT', message } }` on invalid transition, `401 { error: { code: 'UNAUTHORIZED', message } }` if unauthenticated — via the `ok()`/`err()` helpers from Task 1.

- [ ] **Step 1: Write the failing integration test**

Create `tests/api/orders-status-route.test.ts`. This test hits the real Next.js dev server, so it requires `next dev` running — mark it as an integration test that runs against `http://localhost:3000` (started by the same `webServer` config Playwright uses, but here invoked via plain `fetch` in Jest, requiring the dev server to already be running per the Step 2 instructions):

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

describe('POST /api/orders/[orderId]/status', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('rejects a body missing status with 400', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
      .select()
      .single();

    const response = await fetch(`${BASE_URL}/api/orders/${order!.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it('rejects an invalid transition with 422', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
      .select()
      .single();

    const response = await fetch(`${BASE_URL}/api/orders/${order!.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'READY' }),
    });

    expect(response.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Start the dev server in a separate terminal: `npm run dev --workspace=apps/web`
Run: `npm run test --workspace=apps/web -- tests/api/orders-status-route.test.ts`
Expected: FAIL — requests to `/api/orders/.../status` return 404 since the route doesn't exist yet.

- [ ] **Step 3: Implement the route handler**

Create `apps/web/app/api/orders/[orderId]/status/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { updateOrderStatusSchema } from '@restaurant-qr/shared';
import { updateOrderStatus } from '@/lib/services/orderStatusService';

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateOrderStatusSchema.safeParse(body);

  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.errors.map((e) => e.message).join(', '), 400);
  }

  const result = await updateOrderStatus(supabase, params.orderId, parsed.data.status);

  if ('error' in result) {
    return err('CONFLICT', result.error, 422);
  }

  return ok(result, 200);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/api/orders-status-route.test.ts`
Expected: `PASS` — both tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/orders/[orderId]/status/route.ts tests/api/orders-status-route.test.ts
git commit -m "feat: add POST /api/orders/[orderId]/status route handler"
```

---

### Task 4: Realtime + polling fallback hook

**Files:**
- Create: `apps/web/hooks/useRealtimeWithPolling.ts`
- Test: `tests/hooks/useRealtimeWithPolling.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  function useRealtimeWithPolling(options: {
    channelName: string
    table: string
    onChange: () => void
    pollIntervalMs?: number  // default 15000
  }): void
  ```
  Subscribes to a Realtime Postgres Changes channel; if the channel status never reaches `SUBSCRIBED` within 5s, or after subscribing, starts a `setInterval` calling `onChange` every `pollIntervalMs` as a fallback (runs alongside Realtime — harmless double-fetch, no diffing required since callers already do full refetches). This hook is imported by kitchen (this plan), and later by staff, cashier, and manager dashboards.

- [ ] **Step 1: Install React Testing Library for hook tests**

```bash
npm install --save-dev @testing-library/react @testing-library/react-hooks jest-environment-jsdom --workspace=apps/web
```

- [ ] **Step 2: Write the failing test**

Create `tests/hooks/useRealtimeWithPolling.test.tsx`:

```typescript
/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useRealtimeWithPolling } from '../../apps/web/hooks/useRealtimeWithPolling';

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: (cb: (status: string) => void) => { cb('SUBSCRIBED'); return {}; } }),
    }),
    removeChannel: jest.fn(),
  }),
}));

describe('useRealtimeWithPolling', () => {
  jest.useFakeTimers();

  it('calls onChange via polling fallback after the interval elapses', async () => {
    const onChange = jest.fn();

    renderHook(() =>
      useRealtimeWithPolling({
        channelName: 'test-channel',
        table: 'orders',
        onChange,
        pollIntervalMs: 1000,
      })
    );

    jest.advanceTimersByTime(1000);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/hooks/useRealtimeWithPolling.test.tsx --config apps/web/jest.config.ts --env=jsdom`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the hook**

Create `apps/web/hooks/useRealtimeWithPolling.ts`:

```typescript
'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseRealtimeWithPollingOptions {
  channelName: string;
  table: string;
  onChange: () => void;
  pollIntervalMs?: number;
}

export function useRealtimeWithPolling({
  channelName,
  table,
  onChange,
  pollIntervalMs = 15000,
}: UseRealtimeWithPollingOptions): void {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        onChange();
      })
      .subscribe();

    // Polling fallback: runs regardless of Realtime connection state so a
    // silently dropped websocket never leaves the dashboard stale.
    const pollInterval = setInterval(() => {
      onChange();
    }, pollIntervalMs);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, pollIntervalMs]);
}
```

`onChange` is intentionally excluded from the dependency array — callers pass an inline function each render, and re-subscribing the channel on every render would thrash the websocket connection. Callers must ensure `onChange` reads fresh state via closures over `useState` setters (which are stable) rather than relying on this effect re-running.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/hooks/useRealtimeWithPolling.test.tsx --config apps/web/jest.config.ts --env=jsdom`
Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add apps/web/hooks/useRealtimeWithPolling.ts tests/hooks/useRealtimeWithPolling.test.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "feat: add Realtime-with-polling-fallback hook"
```

---

### Task 5: Wire the kitchen dashboard to the API route, polling hook, and add reject action

**Files:**
- Modify: `apps/web/app/(kitchen)/kitchen/page.tsx`

**Interfaces:**
- Consumes: `useRealtimeWithPolling` (Task 4), `POST /api/orders/[orderId]/status` (Task 3).

- [ ] **Step 1: Replace the direct Supabase update with a call to the API route**

In `apps/web/app/(kitchen)/kitchen/page.tsx`, replace the `updateOrderStatus` function body:

```typescript
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error ?? 'Failed to update order status');
      return;
    }

    setErrorMessage(null);
    setOrders((current) =>
      current.filter((order) => order.id !== orderId || newStatus === 'READY')
    );
  };
```

Update the two call sites:
- The "Mark as {nextStatus}" button's `onClick`: `() => updateOrderStatus(order.id, nextStatus[order.status])`
- Add a new reject button (Step 3 below) calling `updateOrderStatus(order.id, 'CANCELLED')`

- [ ] **Step 2: Add error state and display**

Add near the top of the component, alongside the existing `useState` calls:

```typescript
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
```

Add just inside the `<div className="max-w-7xl mx-auto">` wrapper, after the header block:

```tsx
        {errorMessage && (
          <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 rounded-md" role="alert">
            {errorMessage}
          </div>
        )}
```

- [ ] **Step 3: Add a reject-order button**

Inside the `CardContent`, right after the existing "Mark as {nextStatus}" button block, add:

```tsx
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                  >
                    Reject Order
                  </Button>
```

- [ ] **Step 4: Replace the manual Realtime subscription with the polling-fallback hook**

Remove the existing `useEffect` block that creates a `supabase.channel('orders')` subscription (the block starting with `// Subscribe to real-time updates` through `return () => { supabase.removeChannel(channel); };`). Keep the initial `fetchOrders` call in its own `useEffect`, and add:

```typescript
  useRealtimeWithPolling({
    channelName: 'kitchen-orders',
    table: 'orders',
    onChange: fetchOrders,
  });
```

`fetchOrders` must be defined outside the mount-only `useEffect` (hoisted to component scope) so both the initial-load effect and the hook can call it. Restructure the top of the component:

```typescript
export default function KitchenDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supabase = createClient();

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        created_at,
        special_instructions,
        table:tables(table_number, name),
        order_items(
          id,
          quantity,
          special_instructions,
          menu_item:menu_items(name)
        )
      `)
      .in('status', ['PENDING', 'ACCEPTED', 'PREPARING'])
      .order('created_at', { ascending: true });

    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
      setOrders(data as unknown as Order[]);
      setErrorMessage(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeWithPolling({
    channelName: 'kitchen-orders',
    table: 'orders',
    onChange: fetchOrders,
  });
```

- [ ] **Step 5: Add aria-label to the status badge and buttons for accessibility**

Update the `Badge` element to include `aria-label={\`Order status: ${order.status}\`}`, matching feature-spec.md's cross-cutting accessibility requirement (screen reader compatible).

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev --workspace=apps/web` (with local Supabase running per test-infrastructure.md setup)
Navigate to `/kitchen` as a seeded `kitchen_staff` user. Confirm: orders load, "Mark as ACCEPTED/PREPARING/READY" buttons work end-to-end through the new API route, "Reject Order" cancels the order and removes it from the list, and disconnecting network briefly (DevTools offline toggle) then reconnecting shows the dashboard recover via the polling fallback within 15s.

- [ ] **Step 7: Run the full db + service + api test suite to confirm no regressions**

Run: `npm run test --workspace=apps/web -- tests/db tests/services tests/api tests/hooks`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/(kitchen)/kitchen/page.tsx"
git commit -m "fix: route kitchen status updates through update_order_status API, add reject action and polling fallback"
```

---

## Definition of Done for this plan

- [ ] Kitchen dashboard no longer calls `supabase.from('orders').update({ status })` directly — all status changes go through `POST /api/orders/[orderId]/status`, which calls `update_order_status()`.
- [ ] `packages/shared/src/http/apiResponse.ts` (`ok()`/`err()`) exists and is used by every route handler in this plan — this is the shape `staff-dashboard.md`, `payments-and-cashier.md`, and `owner-and-admin.md` are expected to import and reuse, not reinvent.
- [ ] Kitchen dashboard has a working reject-order action (transitions to `CANCELLED`).
- [ ] Kitchen dashboard recovers from a dropped Realtime connection via polling fallback (feature-spec.md cross-cutting requirement).
- [ ] Errors from the API route are shown to the user, not silently swallowed.
- [ ] `tests/services/orderStatusService.test.ts`, `tests/api/orders-status-route.test.ts`, and `tests/hooks/useRealtimeWithPolling.test.tsx` all pass.
- [ ] `useRealtimeWithPolling` and `orderStatusService` exist with the exact signatures documented above for reuse by `staff-dashboard.md`.
