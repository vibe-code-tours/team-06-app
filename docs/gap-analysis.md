# Gap Analysis — Requirement Docs vs Implementation Plans

**Date:** 2026-07-15
**Requirement sources (priority order per CLAUDE.md):** `feature-spec.md`, `tech-stack.md`,
`monorepo-structure.md`, `order.txt` (condensed cross-check).
**Plans audited:** the 8 original plans in `docs/superpowers/plans/` (2026-07-08 → 2026-07-09):
`db-schema`, `test-infrastructure`, `customer-ordering-flow`, `kitchen-dashboard`,
`owner-features`, `payments-and-cashier`, `restaurant-management`, `staff-dashboard`.
(The 2026-07-15 invite-email-flow plan is excluded; the gaps it closes are listed as gaps here.)

---

## 1. Feature coverage summary (feature-spec.md §1-11, cross-checked with order.txt)

| # | Feature | Coverage | Covering plan(s) |
|---|---|---|---|
| 1 | QR Code Management | ⚠️ Partial | `db-schema` (generate + data URL), `staff-dashboard` (per-table download) |
| 2 | Digital Menu | ⚠️ Partial | `customer-ordering-flow` (UI); nested `GET /api/menu/{restaurantId}` endpoint unplanned |
| 3 | Order Management | ✅ | `customer-ordering-flow`, `db-schema` |
| 4 | Kitchen Management | ✅ | `kitchen-dashboard` |
| 5 | Staff Dashboard | ✅ | `staff-dashboard` |
| 6 | Payment Module | ⚠️ Partial | `payments-and-cashier` (payments, refunds); receipts unplanned |
| 7 | Table Session Management | ✅ | `db-schema` (atomic fns), `staff-dashboard` (release) |
| 8 | Restaurant Management | ✅ | `restaurant-management` |
| 9 | Owner Features | ⚠️ Partial | `owner-features`; business hours + reports unplanned |
| 10 | Branding & White Label | ⚠️ Partial | logo/name shown; theme + branded QR unplanned (spec: Medium/Optional) |
| 11 | Role & Permission Mgmt | ⚠️ Partial | RLS/API/UI layers planned; owner-invite, accept-invite, admin-users unplanned |

order.txt confirms the same gaps it independently lists: "Download **and print** QR codes",
"**Regenerate all** QR codes", "**Full menu endpoint** with nested categories and items" —
none planned. Everything else in order.txt (sessions, locking, status enforcement, 9 tables,
7 enums, 4 DB functions, 4 realtime publications, 2 storage buckets, 8 routes) is covered.

---

## 2. Gaps — specced, in no plan

### A. Onboarding & auth flow (feature-spec §11) — *addressed after this audit's cutoff*
1. **Super-admin invites owner** — no plan creates/links an owner auth user;
   `inviteStaffSchema` deliberately excludes `restaurant_owner`. *(In progress on a separate branch.)*
2. **Accept-invite flow** (`POST /api/auth/accept-invite`) — no invite-landing/set-password
   page existed; no invited user could ever log in. *(Closed by `2026-07-15-invite-email-flow-fix.md`.)*
3. **Invite email redirect URL** — no plan passed `redirectTo`; links pointed at localhost in
   deployed environments. *(Closed by the same plan.)*

### B. Functional
4. **QR regeneration** (spec §1, order.txt #1) — appears in no plan.
5. **Batch QR download / print** (spec §1 "Download All", order.txt "download and print") —
   only per-table download planned.
6. **Receipt generation** (spec §6) — zero mentions.
7. **Business hours** (spec §9) — zero mentions.
8. **Reports** (spec §9: daily/weekly/monthly, popular items, peak hours, export).
   **Documented skip reason** (`owner-features` line ~1900): *"sales reports beyond the
   existing basic today's-stats (date-range filters, CSV/PDF export) are a genuinely separate
   feature area and are not part of this plan set."*
9. **Staff role change + individual deactivate** (spec §11 matrix;
   `PUT/DELETE /api/restaurants/{id}/staff/{id}`) — `owner-features` covers invite + list only.
10. **`/api/admin/users`** (spec §11; also `app/api/admin/` in monorepo-structure.md) —
    super-admin user management unplanned; spec DoD requires it.
11. **`GET /api/menu/{restaurantId}`** (spec §2, order.txt #2, monorepo `app/api/menu/`) —
    endpoint never planned; the customer page queries Supabase directly under public RLS.
    Functionally equivalent, but `middleware.ts` whitelists `/api/menu`, a route that doesn't
    exist (dead entry — build the endpoint or remove the whitelist line).

### C. Testing (feature-spec Definition of Done)
12. **E2E tests for the four core flows** (customer order, kitchen status, payment,
    concurrent session locking) — `test-infrastructure` builds the Playwright harness with a
    smoke test only, explicitly *"so every later plan can write real, runnable tests"* — but
    no later plan wrote the flow specs. `e2e/` contains only `smoke.spec.ts`.
13. **Load test for realtime subscriptions** — nowhere.

---

## 3. tech-stack.md deviations

| tech-stack.md says | Reality / plans | Assessment |
|---|---|---|
| Auth: email/password **and magic link** | Only password sign-in planned/built; no `signInWithOtp` anywhere | Gap (minor — magic link is unused by any flow) |
| "Auth Context: global auth state via React Context" | No AuthContext exists; components create Supabase clients directly, middleware owns auth | Deviation, works fine; update doc or add context if needed |
| Storage: "Signed URLs for admin uploads" | Uploads go through `POST /api/uploads` with service-role client; buckets are public-read | Deviation, equivalent security posture |
| Deployment: **Vercel** + Vercel Edge CDN | Deployed on **Netlify**. `SETUP.md` explicitly warns *"Avoid Vercel Hobby for team projects"* | Doc outdated — update tech-stack.md deployment table |
| Prettier listed as dev tool | No prettier config exists in the repo | Doc/tooling drift |
| `@supabase/genersupabase-js` (type generation) | Typo in doc; actual: `supabase gen types` CLI | Doc typo |

Realtime expectations (orders, tables, sessions, payments) are all met — publications in
`db-schema`, UI subscriptions via `useRealtimeWithPolling` (kitchen, staff, cashier pages),
which also satisfies the polling-fallback cross-cutting requirement.

---

## 4. monorepo-structure.md deviations (with reasons where documented)

| Specced | Reality | Reason |
|---|---|---|
| `apps/api` (Express/Fastify backend) | Not built; Next.js route handlers only | Doc itself marks it **"Optional — if not using Supabase Edge Functions"** |
| `supabase/functions/` edge functions (create-order, process-payment, release-table) | Not built; atomics are **Postgres functions** instead | CLAUDE.md architecture rule: *"Atomic operations stay in Postgres functions, not application code"* (SELECT FOR UPDATE locking) — deliberate, better choice |
| `packages/ui` shared components | Not built; components live in `apps/web/components/ui` | Doc marks it "(optional)"; single web app makes it unnecessary |
| `app/api/menu/`, `app/api/admin/` dirs | Don't exist | Real gaps — see §2 #10, #11 |
| Component tree (`components/menu|orders|payments|tables|auth`), hooks (`useAuth`, `useOrders`, …) | Code is colocated per dashboard route; single shared hook `useRealtimeWithPolling` | Structural deviation only; plans colocate by feature — functionality covered |
| Validators split per domain (`validators/order.ts`, …) | Single `packages/shared/src/validators/index.ts` | Trivial deviation |
| `.github/workflows/cd-staging.yml`, `cd-production.yml` | Only `ci.yml`; deploys via Netlify integration | `SETUP.md`: *"Let the platform deploy; don't hand-write deploy jobs"* — deliberate |
| `docs/api|guides|architecture` layout | Actual: `docs/workflows`, `docs/superpowers`, `docs/decisions` | Docs organized around plan-driven workflow instead; harmless |
| `supabase/seed/seed.sql` | `supabase/seed.sql` | Trivial path difference |

---

## 5. Documentation drift

- `docs/workflow.md` marks workflows 4–8 **Pending**, yet their code is substantially
  implemented — completed plans never received workflow docs (violates CLAUDE.md
  Documentation Maintenance).
- `docs/ARCHITECTURE.md` is an unfilled template (placeholders intact).
- `tech-stack.md` deployment section (Vercel) contradicts the actual Netlify deployment.

---

## 6. Suggested priority for closing gaps

1. **E2E flow tests** (#12) — DoD requirement, harness exists, highest risk-reduction.
2. **Staff role change/deactivate** (#9) — permission matrix requires it; small API + UI job.
3. **QR regenerate + batch download/print** (#4, #5) — small; "Core" priority in both
   feature-spec and order.txt.
4. **Receipt generation** (#6) — cashier flow incomplete for real use.
5. **`/api/menu` endpoint or middleware cleanup** (#11) — tiny; removes a dead whitelist entry.
6. **Reports, business hours, `/api/admin/users`** (#7, #8, #10) — larger; schedule as
   separate plans (reports skip was explicitly deferred by `owner-features`).
7. Doc refresh: tech-stack deployment section, workflow docs 4–8, ARCHITECTURE.md.
