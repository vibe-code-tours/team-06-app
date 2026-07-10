# Customer Ordering Flow Gap-Closing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time order status tracking for customers after they place an order (currently completely missing — customers see a static "Order Placed!" screen with no visibility into ACCEPTED/PREPARING/READY/COMPLETED), add the missing special-instructions input, replace `alert()` calls with inline error UI, and add a bill/payment-status view.

**Architecture:** `apps/web/app/(customer)/[restaurantId]/[tableNumber]/page.tsx` currently has three states: loading, menu+cart, and a terminal "order placed" screen with no link back to order status. This plan adds a fourth state — an order-tracking view — that fetches the just-placed order plus any other active orders for the table's current session, subscribes to Realtime with polling fallback, and shows a bill summary once the session's payment_status flips to PAID (which the existing `process_payment()` function already sets on `orders.payment_status`).

**Tech Stack:** Existing `create_order_with_session()` RPC (no changes), `useRealtimeWithPolling` hook (from `kitchen-dashboard.md`), React state machine for the four page states.

**Depends on:** `2026-07-08-test-infrastructure.md`, `2026-07-08-db-schema.md`, `2026-07-09-kitchen-dashboard.md` (for `useRealtimeWithPolling`) must be complete.

## Global Constraints

- Realtime subscriptions always include a polling fallback (per `CLAUDE.md`, `feature-spec.md` cross-cutting).
- TypeScript strict mode; no `any` without a comment explaining why (per `CLAUDE.md`).
- Order status flow customers must be able to observe: `PENDING → ACCEPTED → PREPARING → READY → COMPLETED` (per `feature-spec.md` §3: "Order status tracking: Customers see status updates in real-time").
- Only one `ACTIVE` session per table; this plan must not change that invariant — it only adds a read-only tracking view on top of the existing `create_order_with_session()` behavior (per `feature-spec.md` §7, `CLAUDE.md`).
- Mobile-first responsive layout (primary customer device) — per `feature-spec.md` cross-cutting; the tracking view must fit the same `max-w-4xl` mobile-first layout already used by the menu.
- Touch targets minimum 44x44px on mobile (per `feature-spec.md` cross-cutting Definition of Done) — apply to any new interactive element.

---

## File Structure

```
restaurant-qr-order/
└── apps/web/
    └── app/(customer)/[restaurantId]/[tableNumber]/
        ├── page.tsx                    # MODIFY — special instructions, error UI, order tracking state
        └── OrderTracker.tsx            # NEW — extracted tracking view component
```

**Responsibilities:**
- `OrderTracker.tsx` — a focused component owning the post-order-placement view: fetches all orders tied to the table's current active session, renders a status timeline per order, and shows a paid/unpaid bill summary. Extracted rather than inlined because `page.tsx` is already 343 lines and this adds a genuinely separate concern (tracking vs. browsing/cart).

---

### Task 1: Add special instructions input to the cart

**Files:**
- Modify: `apps/web/app/(customer)/[restaurantId]/[tableNumber]/page.tsx`

**Interfaces:**
- No new exports; purely a UI addition to the existing cart item interaction.

- [ ] **Step 1: Add a special instructions text input per cart item**

The `CartItem` interface already has `special_instructions: string` (line 37) and `placeOrder` already sends it (line 161) — only the input UI is missing. Add an `updateSpecialInstructions` function alongside `updateQuantity`:

```typescript
  const updateSpecialInstructions = (itemId: string, instructions: string) => {
    setCart((prev) =>
      prev.map((ci) =>
        ci.menuItem.id === itemId ? { ...ci, special_instructions: instructions } : ci
      )
    );
  };
```

In the menu item card's cart-item-active branch (where quantity +/- buttons render), add a small text input below the quantity row when `cartItem` exists. Wrap the existing quantity controls block and add:

```tsx
                            {cartItem && (
                              <input
                                type="text"
                                placeholder="Special instructions (e.g. no onions)"
                                value={cartItem.special_instructions}
                                onChange={(e) => updateSpecialInstructions(item.id, e.target.value)}
                                className="mt-2 w-full text-sm border rounded px-2 py-1.5 min-h-[44px]"
                                aria-label={`Special instructions for ${item.name}`}
                              />
                            )}
```

Place this inside the `<div className="flex-1">` block, after the existing quantity-controls `<div className="flex items-center justify-between mt-2">` block closes.

- [ ] **Step 2: Manually verify**

Run: `npm run dev --workspace=apps/web` with local Supabase running and seed data loaded.
Navigate to `/{restaurantId}/{tableNumber}` for a seeded table. Add an item to cart, type into the special instructions field, place the order, then check (via Supabase Studio or a kitchen-dashboard login) that `order_items.special_instructions` contains the typed text.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(customer)/[restaurantId]/[tableNumber]/page.tsx"
git commit -m "feat: add special instructions input to customer cart items"
```

---

### Task 2: Replace alert() calls with inline error UI

**Files:**
- Modify: `apps/web/app/(customer)/[restaurantId]/[tableNumber]/page.tsx`

**Interfaces:**
- No new exports.

- [ ] **Step 1: Add error state**

Add near the other `useState` declarations:

```typescript
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
```

- [ ] **Step 2: Replace the two `alert()` calls in `placeOrder`**

Replace:

```typescript
    if (!tableData) {
      alert('Table not found');
      setSubmitting(false);
      return;
    }
```

with:

```typescript
    if (!tableData) {
      setErrorMessage('Table not found. Please scan the QR code again.');
      setSubmitting(false);
      return;
    }
```

Replace:

```typescript
    if (error) {
      alert('Error placing order: ' + error.message);
    } else {
      setOrderPlaced(true);
      setCart([]);
    }
```

with:

```typescript
    if (error) {
      setErrorMessage(error.message);
    } else {
      setOrderPlaced(true);
      setCart([]);
      setErrorMessage(null);
    }
```

- [ ] **Step 3: Render the error inline in the cart footer**

In the "Cart Footer" fixed-bottom block, add the error message above the Place Order button:

```tsx
            {errorMessage && (
              <div className="mb-3 p-3 text-sm text-red-600 bg-red-50 rounded-md" role="alert">
                {errorMessage}
              </div>
            )}
```

Insert this immediately before the existing `<Button className="w-full" size="lg" onClick={placeOrder} ...>`.

- [ ] **Step 4: Manually verify**

With local Supabase running, try placing an order against a table that already has an active unpaid session (create one first via a second browser tab or Supabase Studio) — confirm the "active session already exists" error from `create_order_with_session()` now shows inline instead of via a browser `alert()`.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(customer)/[restaurantId]/[tableNumber]/page.tsx"
git commit -m "fix: replace alert() calls with inline error UI in customer ordering flow"
```

---

### Task 3: OrderTracker component

**Files:**
- Create: `apps/web/app/(customer)/[restaurantId]/[tableNumber]/OrderTracker.tsx`

**Interfaces:**
- Consumes: `useRealtimeWithPolling` from `@/hooks/useRealtimeWithPolling` (built in `kitchen-dashboard.md`).
- Produces:
  ```typescript
  interface OrderTrackerProps {
    restaurantId: string
    tableId: string
    onStartNewOrder: () => void
  }
  export default function OrderTracker(props: OrderTrackerProps): JSX.Element
  ```
  Consumed by `page.tsx` (Task 4) in place of the current static "Order Placed!" screen.

- [ ] **Step 1: Implement OrderTracker.tsx**

Create `apps/web/app/(customer)/[restaurantId]/[tableNumber]/OrderTracker.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRealtimeWithPolling } from '@/hooks/useRealtimeWithPolling';

interface TrackedOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  special_instructions: string | null;
  menu_item: { name: string };
}

interface TrackedOrder {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
  order_items: TrackedOrderItem[];
}

interface OrderTrackerProps {
  restaurantId: string;
  tableId: string;
  onStartNewOrder: () => void;
}

const STATUS_STEPS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'] as const;

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function OrderTracker({ restaurantId, tableId, onStartNewOrder }: OrderTrackerProps) {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchActiveOrders = async () => {
    const { data: session } = await supabase
      .from('order_sessions')
      .select('id')
      .eq('table_id', tableId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!session) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        payment_status,
        created_at,
        order_items(
          id,
          quantity,
          unit_price,
          special_instructions,
          menu_item:menu_items(name)
        )
      `)
      .eq('table_session_id', session.id)
      .order('created_at', { ascending: true });

    if (data) {
      setOrders(data as unknown as TrackedOrder[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchActiveOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useRealtimeWithPolling({
    channelName: `customer-orders-${tableId}`,
    table: 'orders',
    onChange: fetchActiveOrders,
  });

  const billTotal = orders.reduce(
    (sum, order) =>
      sum + order.order_items.reduce((itemSum, item) => itemSum + item.unit_price * item.quantity, 0),
    0
  );
  const allPaid = orders.length > 0 && orders.every((o) => o.payment_status === 'PAID');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4 py-6">
        <div className="text-center">
          <div className="text-5xl mb-2">✓</div>
          <h1 className="text-2xl font-bold">Order Status</h1>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No active orders for this table.
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Order placed {new Date(order.created_at).toLocaleTimeString()}
                </CardTitle>
                <Badge className={statusColors[order.status]} aria-label={`Order status: ${order.status}`}>
                  {order.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm mb-3">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>
                        {item.quantity}x {item.menu_item.name}
                      </span>
                      <span>${(item.unit_price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                {order.status !== 'CANCELLED' && (
                  <div className="flex gap-1" role="list" aria-label="Order progress">
                    {STATUS_STEPS.map((step) => (
                      <div
                        key={step}
                        role="listitem"
                        className={`h-1.5 flex-1 rounded-full ${
                          STATUS_STEPS.indexOf(order.status as typeof STATUS_STEPS[number]) >=
                          STATUS_STEPS.indexOf(step)
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}

        {orders.length > 0 && (
          <Card>
            <CardContent className="py-4 flex items-center justify-between">
              <span className="font-medium">
                {allPaid ? 'Bill paid' : `Bill total: $${billTotal.toFixed(2)}`}
              </span>
              <Badge variant={allPaid ? 'default' : 'outline'}>
                {allPaid ? 'PAID' : 'UNPAID'}
              </Badge>
            </CardContent>
          </Card>
        )}

        <Button className="w-full min-h-[44px]" variant="outline" onClick={onStartNewOrder}>
          Order More Items
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/app/(customer)/[restaurantId]/[tableNumber]/OrderTracker.tsx"
git commit -m "feat: add OrderTracker component for real-time customer order status"
```

---

### Task 4: Wire OrderTracker into the page

**Files:**
- Modify: `apps/web/app/(customer)/[restaurantId]/[tableNumber]/page.tsx`

**Interfaces:**
- Consumes: `OrderTracker` from `./OrderTracker` (Task 3).

- [ ] **Step 1: Replace the static "Order Placed!" screen with OrderTracker**

The page needs the table's `id` (a UUID), not just `tableNumber` — Task 1/2's `placeOrder` already fetches `tableData.id` locally but doesn't persist it to component state. Add a state variable:

```typescript
  const [tableId, setTableId] = useState<string | null>(null);
```

In `placeOrder`, after the existing `tableData` fetch succeeds, store it:

```typescript
    setTableId(tableData.id);
```

(Insert this line right after the existing `if (!tableData) { ... return; }` block, before the `create_order_with_session` RPC call.)

Replace the entire `if (orderPlaced) { ... }` block:

```tsx
  if (orderPlaced && tableId) {
    return (
      <OrderTracker
        restaurantId={restaurantId}
        tableId={tableId}
        onStartNewOrder={() => setOrderPlaced(false)}
      />
    );
  }
```

Add the import at the top of the file:

```typescript
import OrderTracker from './OrderTracker';
```

- [ ] **Step 2: Manually verify end-to-end**

Run: `npm run dev --workspace=apps/web` with local Supabase running.
1. Place an order as a customer — confirm it transitions to the OrderTracker view showing `PENDING` status.
2. In a second browser tab, log in as `kitchen_staff` and advance the order through ACCEPTED → PREPARING → READY.
3. Confirm the customer's OrderTracker view updates in real time (or within 15s via polling fallback) to reflect each status change, without a page refresh.
4. Log in as `cashier`, process payment for the order.
5. Confirm the customer's OrderTracker view flips to "Bill paid".

- [ ] **Step 3: Run full test suite to confirm no regressions**

Run: `npm run test --workspace=apps/web -- tests/db tests/services tests/api tests/hooks`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(customer)/[restaurantId]/[tableNumber]/page.tsx"
git commit -m "feat: wire OrderTracker into customer ordering flow after order placement"
```

---

## Definition of Done for this plan

- [ ] Customers can enter special instructions per cart item, and they reach `order_items.special_instructions`.
- [ ] No `alert()` calls remain in the customer ordering flow; errors show inline.
- [ ] After placing an order, customers see a live-updating status view (PENDING → ACCEPTED → PREPARING → READY → COMPLETED) covering every active order in their table session, not just the one just placed.
- [ ] The tracking view recovers from a dropped Realtime connection via polling fallback.
- [ ] The tracking view shows PAID/UNPAID bill status, reflecting `process_payment()`'s effect on `orders.payment_status`.
- [ ] Manually verified end-to-end: place order → kitchen advances status → customer sees updates live → cashier pays → customer sees "Bill paid".
