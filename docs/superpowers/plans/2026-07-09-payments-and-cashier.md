# Payments & Cashier Gap-Closing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing `refund_payment()` atomic Postgres function and its API route, fix the cashier dashboard's hardcoded 10% tax rate to read from `restaurants.tax_rate`, add a discount input, wire up the `?order=` query param handoff from the staff dashboard, add a refund UI, and replace the Realtime-only subscription with the polling-fallback hook.

**Architecture:** The DB layer has `process_payment()` but no refund function — `feature-spec.md` §6 requires "Refund processing: Reverse payments with reason and refund status" and `packages/shared/src/validators/index.ts` already defines `refundPaymentSchema = z.object({ reason: z.string().min(1) })`, but nothing calls it. This plan adds a new migration for `refund_payment()`, a `POST /api/payments/[paymentId]/refund` route, and wires the cashier UI to use it.

**Tech Stack:** PostgreSQL (new migration), Next.js Route Handlers, Zod, existing `process_payment()` function, `useRealtimeWithPolling` hook (from `kitchen-dashboard.md`).

**Depends on:** `2026-07-08-test-infrastructure.md`, `2026-07-08-db-schema.md`, `2026-07-09-kitchen-dashboard.md` (for `useRealtimeWithPolling` and the shared `ok()`/`err()` response envelope in `packages/shared/src/http/apiResponse.ts`), `2026-07-09-staff-dashboard.md` (which introduced the `/cashier?order=` link) must be complete.

## Global Constraints

- Atomic operations stay in Postgres functions, not application code (per `CLAUDE.md`) — `refund_payment()` must be a `SECURITY DEFINER` transactional function, matching the style of `process_payment()`.
- Any schema change requires a new migration file; never hand-edit `20250706000000_initial_schema.sql` (per `CLAUDE.md`).
- Handlers stay thin (per `CLAUDE.md`).
- Permission matrix per `feature-spec.md` §11: "Issue refund" is Super Admin / Owner / Manager only — NOT Cashier. This plan's refund route must enforce that, even though the cashier dashboard is where payments are viewed.
- All API route handlers return responses via `ok()`/`err()` from `packages/shared/src/http/apiResponse.ts` (established in `kitchen-dashboard.md`) — never call `NextResponse.json(...)` directly.
- Payment flow per `feature-spec.md` §6: cashier views order summary with tax and discounts, confirms payment, order auto-completes, session closes, table releases — all of this already works via `process_payment()`; this plan only adds what's missing (tax rate correctness, discount input, refunds).

---

## File Structure

```
restaurant-qr-order/
├── supabase/migrations/
│   └── 20260709000000_refund_payment_function.sql   # NEW
├── apps/web/
│   ├── app/
│   │   ├── api/
│   │   │   └── payments/
│   │   │       └── [paymentId]/
│   │   │           └── refund/
│   │   │               └── route.ts       # NEW — POST: refund_payment wrapper
│   │   └── (cashier)/cashier/
│   │       └── page.tsx                   # MODIFY — real tax rate, discount input, refund UI, query param, polling
│   └── lib/
│       └── services/
│           └── paymentService.ts          # NEW — refundPayment
└── tests/
    ├── db/
    │   └── fn-refund-payment.test.ts      # NEW
    ├── services/
    │   └── paymentService.test.ts         # NEW
    └── api/
        └── payments-refund-route.test.ts  # NEW
```

---

### Task 1: `refund_payment()` Postgres function

**Files:**
- Create: `supabase/migrations/20260709000000_refund_payment_function.sql`
- Test: `tests/db/fn-refund-payment.test.ts`

**Interfaces:**
- Produces: `refund_payment(p_payment_id UUID, p_reason TEXT) RETURNS UUID` — sets the payment's `payment_status` to `REFUNDED`, appends the reason to `payments.notes`, and does NOT reopen the order/table (a refund is a financial reversal, not an operational one — the order stays `COMPLETED`/table stays whatever it currently is, matching `feature-spec.md` §6 which only says "Reverse payments with reason and refund status", not "reopen the table"). Consumed by `paymentService.ts` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `tests/db/fn-refund-payment.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

describe('refund_payment()', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('marks a COMPLETED payment as REFUNDED and stores the reason', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    const { data: paymentId } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 12.5,
      p_payment_method: 'CASH',
    });

    const { data: refundedId, error } = await serviceClient.rpc('refund_payment', {
      p_payment_id: paymentId,
      p_reason: 'Customer complaint about food quality',
    });

    expect(error).toBeNull();
    expect(refundedId).toBe(paymentId);

    const { data: payment } = await serviceClient
      .from('payments')
      .select('payment_status, notes')
      .eq('id', paymentId)
      .single();
    expect(payment!.payment_status).toBe('REFUNDED');
    expect(payment!.notes).toMatch(/Customer complaint about food quality/);
  });

  it('rejects refunding a payment that is not COMPLETED', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId })
      .select()
      .single();
    const { data: payment } = await serviceClient
      .from('payments')
      .insert({
        order_id: order!.id,
        restaurant_id: fixture.restaurantId,
        amount: 10,
        total_amount: 10,
        payment_method: 'CASH',
        payment_status: 'PENDING',
      })
      .select()
      .single();

    const { error } = await serviceClient.rpc('refund_payment', {
      p_payment_id: payment!.id,
      p_reason: 'test',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Cannot refund a payment that is not completed/);
  });

  it('rejects refunding an already-refunded payment', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    const { data: paymentId } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 12.5,
      p_payment_method: 'CASH',
    });
    await serviceClient.rpc('refund_payment', { p_payment_id: paymentId, p_reason: 'first refund' });

    const { error } = await serviceClient.rpc('refund_payment', {
      p_payment_id: paymentId,
      p_reason: 'second attempt',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Cannot refund a payment that is not completed/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- tests/db/fn-refund-payment.test.ts`
Expected: FAIL — `refund_payment` function does not exist (`PGRST202` or similar RPC-not-found error).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260709000000_refund_payment_function.sql`:

```sql
-- =============================================================================
-- Refund Payment Function
-- =============================================================================
-- feature-spec.md §6 requires refund processing with a reason field. The
-- initial schema migration implemented process_payment() but not its
-- inverse. This adds refund_payment() following the same atomic,
-- SECURITY DEFINER pattern as the other business functions.
--
-- Design decision: a refund is a financial reversal only. It does NOT
-- reopen the order (stays COMPLETED) or change table status — the guests
-- have already left. Staff must use release_table() separately if the
-- table itself needs manual intervention.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refund_payment(
    p_payment_id    UUID,
    p_reason        TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment           RECORD;
    v_current_user_id   UUID;
BEGIN
    v_current_user_id := auth.uid();

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found: %', p_payment_id;
    END IF;

    IF v_payment.payment_status != 'COMPLETED' THEN
        RAISE EXCEPTION 'Cannot refund a payment that is not completed. Current status: %', v_payment.payment_status;
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'A refund reason is required';
    END IF;

    UPDATE public.payments
    SET payment_status = 'REFUNDED',
        notes = COALESCE(notes || E'\n', '') || 'REFUNDED by ' || COALESCE(v_current_user_id::TEXT, 'system') || ': ' || p_reason,
        updated_at = now()
    WHERE id = p_payment_id;

    UPDATE public.orders
    SET payment_status = 'UNPAID',
        updated_at = now()
    WHERE id = v_payment.order_id;

    RETURN p_payment_id;
END;
$$;

COMMENT ON FUNCTION public.refund_payment(UUID, TEXT) IS
    'Reverses a completed payment: sets payment_status to REFUNDED, appends the reason to notes, '
    'and marks the parent order UNPAID again. Does not reopen order status or table status.';
```

- [ ] **Step 4: Apply and run the test**

Run: `npm run db:reset`
Run: `npm run test --workspace=apps/web -- tests/db/fn-refund-payment.test.ts`
Expected: `PASS` — all 3 tests green.

- [ ] **Step 5: Regenerate types**

Run: `npm run types:generate`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260709000000_refund_payment_function.sql tests/db/fn-refund-payment.test.ts packages/shared/src/types/database.ts
git commit -m "feat: add refund_payment atomic Postgres function"
```

---

### Task 2: Payment service and API route

**Files:**
- Create: `apps/web/lib/services/paymentService.ts`
- Create: `apps/web/app/api/payments/[paymentId]/refund/route.ts`
- Test: `tests/services/paymentService.test.ts`
- Test: `tests/api/payments-refund-route.test.ts`

**Interfaces:**
- Produces:
  - `refundPayment(client: SupabaseClient, paymentId: string, reason: string): Promise<{ success: true } | { error: string }>`
  - `POST /api/payments/:paymentId/refund` with body `{ reason: string }` → `200 { success: true }` / `403` for non-manager+ roles / `400` on missing reason / `422` on service error.

- [ ] **Step 1: Write the failing service test**

Create `tests/services/paymentService.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';
import { refundPayment } from '../../apps/web/lib/services/paymentService';

describe('paymentService', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('refunds a completed payment', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    const { data: paymentId } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 12.5,
      p_payment_method: 'CASH',
    });

    const result = await refundPayment(serviceClient, paymentId, 'wrong order delivered');

    expect(result).toEqual({ success: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- tests/services/paymentService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement paymentService.ts**

Create `apps/web/lib/services/paymentService.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

export type RefundPaymentResult = { success: true } | { error: string };

export async function refundPayment(
  client: SupabaseClient,
  paymentId: string,
  reason: string
): Promise<RefundPaymentResult> {
  const { error } = await client.rpc('refund_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/services/paymentService.test.ts`
Expected: `PASS`

- [ ] **Step 5: Write the failing API route test**

Create `tests/api/payments-refund-route.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

describe('POST /api/payments/[paymentId]/refund', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('returns 400 when reason is missing', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    const { data: paymentId } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 12.5,
      p_payment_method: 'CASH',
    });

    const response = await fetch(`${BASE_URL}/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Start dev server: `npm run dev --workspace=apps/web`
Run: `npm run test --workspace=apps/web -- tests/api/payments-refund-route.test.ts`
Expected: FAIL — 404, route doesn't exist.

- [ ] **Step 7: Implement the route handler**

Create `apps/web/app/api/payments/[paymentId]/refund/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { refundPaymentSchema } from '@restaurant-qr/shared';
import { refundPayment } from '@/lib/services/paymentService';

const ALLOWED_ROLES = ['manager', 'restaurant_owner', 'super_admin'];

export async function POST(
  request: Request,
  { params }: { params: { paymentId: string } }
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

  const body = await request.json().catch(() => null);
  const parsed = refundPaymentSchema.safeParse(body);

  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.errors.map((e) => e.message).join(', '), 400);
  }

  const result = await refundPayment(supabase, params.paymentId, parsed.data.reason);

  if ('error' in result) {
    return err('CONFLICT', result.error, 422);
  }

  return ok(result, 200);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/api/payments-refund-route.test.ts`
Expected: `PASS`

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/services/paymentService.ts "apps/web/app/api/payments/[paymentId]/refund/route.ts" tests/services/paymentService.test.ts tests/api/payments-refund-route.test.ts
git commit -m "feat: add refund payment service and API route"
```

---

### Task 3: Fix cashier dashboard — real tax rate, discount, query param, refunds, error handling, polling

**Files:**
- Modify: `apps/web/app/(cashier)/cashier/page.tsx`

**Interfaces:**
- Consumes: `useRealtimeWithPolling` (from `kitchen-dashboard.md`), `POST /api/payments/[paymentId]/refund`, `useSearchParams` from `next/navigation`.

- [ ] **Step 1: Fetch the restaurant's real tax rate instead of hardcoding 10%**

Replace the `useState(0.1)` line:

```typescript
  const [taxRate, setTaxRate] = useState(0);
```

Inside the existing `fetchOrders` effect (hoist it to component scope per the pattern in `kitchen-dashboard.md`/`staff-dashboard.md`), add a parallel fetch of the current user's restaurant tax rate:

```typescript
  const fetchTaxRate = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('restaurant_id')
      .eq('id', user.id)
      .single();
    if (!profile?.restaurant_id) return;

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('tax_rate')
      .eq('id', profile.restaurant_id)
      .single();
    if (restaurant) {
      setTaxRate(Number(restaurant.tax_rate));
    }
  };
```

Call `fetchTaxRate()` alongside `fetchOrders()` in the mount effect.

- [ ] **Step 2: Add a discount input**

Add state:

```typescript
  const [discountAmount, setDiscountAmount] = useState(0);
```

Update `calculateSummary` to accept and apply the discount:

```typescript
  const calculateSummary = (order: Order): PaymentSummary & { discount: number } => {
    const subtotal = order.order_items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );
    const tax = subtotal * taxRate;
    const discount = Math.min(discountAmount, subtotal + tax);
    const total = subtotal + tax - discount;

    return { subtotal, tax, discount, total };
  };
```

Update the `PaymentSummary` interface to include `discount: number`.

Add a discount `Input` in the Payment Summary card, between the itemized list and the totals block:

```tsx
                    <div className="space-y-1">
                      <label htmlFor="discount" className="text-sm font-medium">
                        Discount ($)
                      </label>
                      <Input
                        id="discount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                      />
                    </div>
```

Add a "Discount" line to the totals display, between Tax and Total:

```tsx
                      {calculateSummary(selectedOrder).discount > 0 && (
                        <div className="flex justify-between text-sm text-green-700">
                          <span>Discount</span>
                          <span>-${calculateSummary(selectedOrder).discount.toFixed(2)}</span>
                        </div>
                      )}
```

Update `processPayment` to pass the discount to the RPC:

```typescript
    const { data, error } = await supabase.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: summary.subtotal,
      p_tax_amount: summary.tax,
      p_discount_amount: summary.discount,
      p_payment_method: method,
    });
```

Reset `discountAmount` to `0` after a successful payment (inside the `if (!error)`/now `if (error)` block, see Step 3).

- [ ] **Step 3: Add error handling**

Add state:

```typescript
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
```

Update `processPayment`'s response handling:

```typescript
    if (error) {
      setErrorMessage(error.message);
      setProcessing(false);
      return;
    }

    setOrders(orders.filter((o) => o.id !== orderId));
    setSelectedOrder(null);
    setDiscountAmount(0);
    setErrorMessage(null);
    setProcessing(false);
```

Remove the old trailing `setProcessing(false);` (now handled in both branches above). Add error display near the top of the page body, after the header:

```tsx
        {errorMessage && (
          <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 rounded-md" role="alert">
            {errorMessage}
          </div>
        )}
```

- [ ] **Step 4: Wire the `?order=` query param from the staff dashboard link**

Add `'use client'` is already present. Import `useSearchParams` from `next/navigation`. Add an effect that preselects the order once both `orders` and the query param are available:

```typescript
  const searchParams = useSearchParams();

  useEffect(() => {
    const orderIdParam = searchParams.get('order');
    if (orderIdParam) {
      const match = orders.find((o) => o.id === orderIdParam);
      if (match) {
        setSelectedOrder(match);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, searchParams]);
```

- [ ] **Step 5: Add a refund action for already-paid/completed orders**

The current fetch only pulls `UNPAID` orders, so refunds need a separate small "Recent Payments" list. Add a second fetch and section:

```typescript
  interface RecentPayment {
    id: string;
    total_amount: number;
    payment_status: string;
    order: { table: { table_number: number } };
  }

  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);

  const fetchRecentPayments = async () => {
    const { data } = await supabase
      .from('payments')
      .select('id, total_amount, payment_status, order:orders(table:tables(table_number))')
      .eq('payment_status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setRecentPayments(data as unknown as RecentPayment[]);
    }
  };
```

Call `fetchRecentPayments()` in the mount effect alongside `fetchOrders()` and `fetchTaxRate()`.

Add a refund handler:

```typescript
  const handleRefund = async (paymentId: string) => {
    const reason = window.prompt('Refund reason (required):');
    if (!reason || reason.trim().length === 0) return;

    const response = await fetch(`/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error ?? 'Failed to process refund');
      return;
    }

    setErrorMessage(null);
    fetchRecentPayments();
  };
```

`window.prompt` is a deliberate minimal choice here — a proper modal is out of scope for this gap-closing pass; note this as a follow-up in the Definition of Done below rather than building a full dialog component.

Add a "Recent Payments" card below the existing two-column grid (full width), before the closing `</div>` of `max-w-7xl mx-auto`:

```tsx
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="py-4 text-center text-gray-500">No recent payments</div>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-2 border-b last:border-0">
                    <span>Table {payment.order.table.table_number} — ${Number(payment.total_amount).toFixed(2)}</span>
                    <Button size="sm" variant="destructive" onClick={() => handleRefund(payment.id)}>
                      Refund
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
```

- [ ] **Step 6: Replace manual Realtime subscription with the polling-fallback hook**

Remove the existing `useEffect` block containing `supabase.channel('cashier-updates')...`. Add, after the mount effect:

```typescript
  useRealtimeWithPolling({
    channelName: 'cashier-orders',
    table: 'orders',
    onChange: fetchOrders,
  });

  useRealtimeWithPolling({
    channelName: 'cashier-payments',
    table: 'payments',
    onChange: fetchRecentPayments,
  });
```

Import `useRealtimeWithPolling` from `@/hooks/useRealtimeWithPolling`.

- [ ] **Step 7: Manually verify in the browser**

Run: `npm run dev --workspace=apps/web` with local Supabase running.
Navigate to `/cashier` as a seeded `cashier`. Confirm: tax line reflects the restaurant's actual `tax_rate` (not always 10%), discount input reduces the total, payment succeeds and clears state, navigating from `/staff` via "Process Payment" preselects the right order, and a completed payment appears in "Recent Payments" with a working Refund button (prompts for a reason, then removes... actually stays visible but status changes — verify the row updates or manually confirm via Supabase Studio that `payment_status` becomes `REFUNDED`).

- [ ] **Step 8: Run full test suite**

Run: `npm run test --workspace=apps/web -- tests/db tests/services tests/api tests/hooks`
Expected: all PASS, no regressions.

- [ ] **Step 9: Commit**

```bash
git add "apps/web/app/(cashier)/cashier/page.tsx"
git commit -m "fix: cashier dashboard uses real tax rate, adds discount input, refunds, and polling fallback"
```

---

## Definition of Done for this plan

- [ ] `refund_payment()` Postgres function exists, is tested, and is the only way payments get reversed (no direct `payments` table updates from the app).
- [ ] Cashier dashboard reads `restaurants.tax_rate` instead of a hardcoded 10%.
- [ ] Cashier dashboard supports entering a discount amount before payment.
- [ ] Cashier dashboard preselects the order passed via `?order=` query param from the staff dashboard link.
- [ ] Cashier dashboard has a working refund action restricted to manager/owner/super_admin at the API layer.
- [ ] Cashier dashboard recovers from a dropped Realtime connection via polling fallback.
- [ ] Errors are shown to the user, not silently swallowed.
- [ ] Known follow-up (not in scope): the refund reason prompt uses `window.prompt`; a proper modal dialog is deferred to a future UI-polish pass.
