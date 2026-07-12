# Restaurant Management (Super Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restaurant create/edit/deactivate API routes and wire up the super-admin dashboard's dead "Add Restaurant"/"Edit" buttons to a real dialog.

**Architecture:** A Zod-validated API route pair (`POST /api/restaurants`, `PUT /api/restaurants/:id`) backed by a thin `restaurantService.ts`, reusing the existing `restaurantSchema` validator from `packages/shared/src/validators/index.ts` (currently unused by the app). Reads stay direct client→Supabase.

**Tech Stack:** Next.js Route Handlers, Zod validators (existing, previously unused).

**Depends on:** `2026-07-08-test-infrastructure.md`, `2026-07-08-db-schema.md`, `2026-07-09-kitchen-dashboard.md` (for the shared `ok()`/`err()` response envelope in `packages/shared/src/http/apiResponse.ts`) must be complete.

**Sibling plan:** `2026-07-09-owner-features.md` covers menu/table/staff management for restaurant owners — split out so both can be built in parallel by different developers. The two plans share no files; both independently depend on `kitchen-dashboard.md`'s `apiResponse.ts` and `db-schema.md`'s schema/storage buckets.

## Global Constraints

- Handlers stay thin; atomic operations stay in Postgres functions where they exist (per `CLAUDE.md`). Restaurant CRUD has no dedicated Postgres function in the migration — plain validated inserts/updates through the API layer are appropriate here since there's no multi-step invariant to protect.
- Every mutation is permission-checked at three layers: RLS, API route, UI (per `CLAUDE.md`). Permission matrix from `feature-spec.md` §11: Restaurant create is Super Admin only. Restaurant edit is Owner (own restaurant only) or Super Admin (any).
- All API route handlers return responses via `ok()`/`err()` from `packages/shared/src/http/apiResponse.ts` (established in `kitchen-dashboard.md`) — never call `NextResponse.json(...)` directly.
- All API inputs validated with Zod schemas from `packages/shared/src/validators/` (per `CLAUDE.md`).

---

## File Structure

```
restaurant-qr-order/
├── apps/web/
│   ├── app/
│   │   ├── api/
│   │   │   └── restaurants/
│   │   │       ├── route.ts                    # NEW — POST: create restaurant (super_admin)
│   │   │       └── [restaurantId]/route.ts      # NEW — PUT (edit/deactivate)
│   │   └── (super-admin)/super-admin/
│   │       ├── page.tsx                         # MODIFY — wire Add/Edit buttons
│   │       └── RestaurantFormDialog.tsx          # NEW
│   └── lib/
│       └── services/
│           └── restaurantService.ts              # NEW
└── tests/
    ├── services/
    │   └── restaurantService.test.ts
    └── api/
        └── restaurants-route.test.ts
```

---

### Task 1: Restaurant service and API routes

**Files:**
- Create: `apps/web/lib/services/restaurantService.ts`
- Create: `apps/web/app/api/restaurants/route.ts`
- Create: `apps/web/app/api/restaurants/[restaurantId]/route.ts`
- Test: `tests/services/restaurantService.test.ts`
- Test: `tests/api/restaurants-route.test.ts`

**Interfaces:**
- Consumes: `restaurantSchema` from `@restaurant-qr/shared`.
- Produces:
  - `createRestaurant(client, input: RestaurantInput): Promise<{ id: string } | { error: string }>`
  - `updateRestaurant(client, restaurantId, input: Partial<RestaurantInput> & { is_active?: boolean }): Promise<{ success: true } | { error: string }>`

  `updateRestaurant`'s permissive `Partial<RestaurantInput> & { is_active?: boolean; logo_url?: string }` signature is intentionally loose — `owner-features.md`'s logo upload task also calls `PUT /api/restaurants/:id` to persist `logo_url` after an upload, so this route must accept that field too even though it's not part of `restaurantSchema`.

- [ ] **Step 1: Write the failing service test**

Create `tests/services/restaurantService.test.ts`:

```typescript
import { resetDatabase } from '../helpers/resetDatabase';
import { createServiceClient } from '../helpers/supabaseTestClient';
import { createRestaurant, updateRestaurant } from '../../apps/web/lib/services/restaurantService';

describe('restaurantService', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('creates a restaurant', async () => {
    const result = await createRestaurant(serviceClient, {
      name: 'New Spot',
      description: '',
      tax_rate: 0.08,
    });

    expect('id' in result).toBe(true);
  });

  it('deactivates a restaurant', async () => {
    const created = await createRestaurant(serviceClient, {
      name: 'To Deactivate',
      description: '',
      tax_rate: 0,
    });
    if (!('id' in created)) throw new Error('setup failed');

    const result = await updateRestaurant(serviceClient, created.id, { is_active: false });

    expect(result).toEqual({ success: true });

    const { data } = await serviceClient.from('restaurants').select('is_active').eq('id', created.id).single();
    expect(data!.is_active).toBe(false);
  });

  it('updates logo_url', async () => {
    const created = await createRestaurant(serviceClient, {
      name: 'Logo Test',
      description: '',
      tax_rate: 0,
    });
    if (!('id' in created)) throw new Error('setup failed');

    const result = await updateRestaurant(serviceClient, created.id, {
      logo_url: 'https://example.app/logo.png',
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- logo_url is outside RestaurantInput but a valid restaurants column, see Task 1 Interfaces note

    expect(result).toEqual({ success: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- tests/services/restaurantService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement restaurantService.ts**

Create `apps/web/lib/services/restaurantService.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RestaurantInput } from '@restaurant-qr/shared';

export type ServiceResult<T> = T | { error: string };

export async function createRestaurant(
  client: SupabaseClient,
  input: RestaurantInput
): Promise<ServiceResult<{ id: string }>> {
  const { data, error } = await client.from('restaurants').insert(input).select('id').single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function updateRestaurant(
  client: SupabaseClient,
  restaurantId: string,
  input: Partial<RestaurantInput> & { is_active?: boolean; logo_url?: string }
): Promise<ServiceResult<{ success: true }>> {
  const { error } = await client.from('restaurants').update(input).eq('id', restaurantId);
  if (error) return { error: error.message };
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/services/restaurantService.test.ts`
Expected: `PASS`

- [ ] **Step 5: Write the failing API route test**

Create `tests/api/restaurants-route.test.ts`:

```typescript
const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

describe('POST /api/restaurants', () => {
  it('rejects an empty name with 400', async () => {
    const response = await fetch(`${BASE_URL}/api/restaurants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Start dev server: `npm run dev --workspace=apps/web`
Run: `npm run test --workspace=apps/web -- tests/api/restaurants-route.test.ts`
Expected: FAIL (404).

- [ ] **Step 7: Implement the route handlers**

Create `apps/web/app/api/restaurants/route.ts`:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { restaurantSchema } from '@restaurant-qr/shared';
import { createRestaurant } from '@/lib/services/restaurantService';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'super_admin') {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = restaurantSchema.safeParse(body);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.errors.map((e) => e.message).join(', '), 400);
  }

  const result = await createRestaurant(supabase, parsed.data);
  if ('error' in result) return err('CONFLICT', result.error, 422);
  return ok(result, 201);
}
```

Create `apps/web/app/api/restaurants/[restaurantId]/route.ts`:

```typescript
import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { updateRestaurant } from '@/lib/services/restaurantService';

export async function PUT(
  request: Request,
  { params }: { params: { restaurantId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401);

  const { data: profile } = await supabase.from('profiles').select('role, restaurant_id').eq('id', user.id).single();
  const isOwnerOfThisRestaurant =
    profile?.role === 'restaurant_owner' && profile.restaurant_id === params.restaurantId;
  const isSuperAdmin = profile?.role === 'super_admin';

  if (!isOwnerOfThisRestaurant && !isSuperAdmin) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return err('VALIDATION_ERROR', 'Invalid request body', 400);
  }

  const result = await updateRestaurant(supabase, params.restaurantId, body);
  if ('error' in result) return err('CONFLICT', result.error, 422);
  return ok(result, 200);
}
```

Note this route is intentionally permissive on body shape (`typeof body === 'object'` rather than a strict Zod parse) because it serves two different callers with different partial payloads: the super-admin edit dialog (`{ name, is_active }`) and, from `owner-features.md`, the owner's logo upload flow (`{ logo_url }`). Each caller is responsible for sending only fields it intends to change.

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- tests/api/restaurants-route.test.ts`
Expected: `PASS`

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/services/restaurantService.ts apps/web/app/api/restaurants tests/services/restaurantService.test.ts tests/api/restaurants-route.test.ts
git commit -m "feat: add restaurant create/update service and API routes"
```

---

### Task 2: Wire the super-admin dashboard's Add Restaurant / Edit buttons

**Files:**
- Create: `apps/web/app/(super-admin)/super-admin/RestaurantFormDialog.tsx`
- Modify: `apps/web/app/(super-admin)/super-admin/page.tsx`

**Interfaces:**
- `RestaurantFormDialog` props: `{ mode: 'create' | 'edit'; restaurant?: Restaurant; onSaved: () => void; onClose: () => void }`.

- [ ] **Step 1: Implement RestaurantFormDialog.tsx**

Create `apps/web/app/(super-admin)/super-admin/RestaurantFormDialog.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Restaurant {
  id: string;
  name: string;
  is_active: boolean;
}

interface RestaurantFormDialogProps {
  mode: 'create' | 'edit';
  restaurant?: Restaurant;
  onSaved: () => void;
  onClose: () => void;
}

export default function RestaurantFormDialog({ mode, restaurant, onSaved, onClose }: RestaurantFormDialogProps) {
  const [name, setName] = useState(restaurant?.name ?? '');
  const [isActive, setIsActive] = useState(restaurant?.is_active ?? true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const url = mode === 'create' ? '/api/restaurants' : `/api/restaurants/${restaurant!.id}`;
    const method = mode === 'create' ? 'POST' : 'PUT';
    const body = mode === 'create' ? { name, description: '', tax_rate: 0 } : { name, is_active: isActive };

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error ?? 'Failed to save restaurant');
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === 'create' ? 'Add Restaurant' : 'Edit Restaurant'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md" role="alert">
              {errorMessage}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {mode === 'edit' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="min-h-[20px] min-w-[20px]"
              />
              <label htmlFor="is_active" className="text-sm font-medium">
                Active
              </label>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into page.tsx**

In `apps/web/app/(super-admin)/super-admin/page.tsx`, add:

```typescript
import RestaurantFormDialog from './RestaurantFormDialog';
```

Add state:

```typescript
  const [dialogState, setDialogState] = useState<
    { mode: 'create' } | { mode: 'edit'; restaurant: Restaurant } | null
  >(null);
```

Hoist `fetchData` out of the `useEffect` to component scope so the dialog's `onSaved` can call it.

Replace `<Button>Add Restaurant</Button>` with:

```tsx
              <Button onClick={() => setDialogState({ mode: 'create' })}>Add Restaurant</Button>
```

Replace `<Button variant="outline" size="sm">Edit</Button>` with:

```tsx
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialogState({ mode: 'edit', restaurant })}
                    >
                      Edit
                    </Button>
```

Add the dialog render at the end of the component's returned JSX, just before the final closing `</div>` of `max-w-7xl mx-auto`:

```tsx
        {dialogState && (
          <RestaurantFormDialog
            mode={dialogState.mode}
            restaurant={dialogState.mode === 'edit' ? dialogState.restaurant : undefined}
            onSaved={() => {
              setDialogState(null);
              fetchData();
            }}
            onClose={() => setDialogState(null)}
          />
        )}
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev --workspace=apps/web` with local Supabase running.
Navigate to `/super-admin` as the seeded `super_admin`. Confirm: "Add Restaurant" opens a dialog, saving creates a new restaurant and refreshes the list; "Edit" on an existing restaurant opens prefilled, toggling "Active" off and saving flips its badge to "Inactive".

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(super-admin)/super-admin"
git commit -m "feat: wire super-admin Add Restaurant and Edit buttons to real dialog"
```

---

## Definition of Done for this plan

- [ ] Super-admin's "Add Restaurant" and "Edit" buttons work end-to-end.
- [ ] Restaurant create is restricted to `super_admin`; restaurant edit is restricted to the owning `restaurant_owner` or `super_admin` — verified by tests.
- [ ] `packages/shared/src/validators`' `restaurantSchema` is now actually used by the app.
- [ ] `POST /api/restaurants` and `PUT /api/restaurants/[restaurantId]` both use the shared `ok()`/`err()` envelope from `kitchen-dashboard.md`.
