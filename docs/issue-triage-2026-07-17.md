# Issue Triage — 2026-07-17

Triage of all 12 open GitHub issues at the time of this run, via the `issue-triage` subagent
(`.claude/agents/issue-triage.md`) against the actual codebase, not just the report text.
Read-only — no labels applied, no issues closed, no comments posted as part of this run.

**Label caveat:** this repo's actual label set is only
`bug, documentation, duplicate, enhancement, good first issue, help wanted, invalid, question, wontfix, dependencies, github_actions`.
There are no `priority-P0`–`P3`, `needs-security-review`, or `needs-schema-change` labels —
priority below is a triage judgment call, not an applied GitHub label.

---

## P0 — Critical, both confirmed real, both on the payment/order critical path

### #36 — SECURITY DEFINER functions have no authorization checks
**Status:** assigned (in progress by another developer)

Verified true for all 4 functions (`refund_payment`, `update_order_status`, `process_payment`,
`release_table`): none check caller role or restaurant membership; none are `REVOKE`d from
`PUBLIC`. Any anonymous caller can hit these directly via `/rest/v1/rpc/<fn>`. `process_payment`
is the most exposed — called client-side with no server route in front of it at all.

- Fix: new migration adding in-function role/restaurant checks + `REVOKE EXECUTE FROM PUBLIC, anon`
- Files: `supabase/migrations/20250706000000_initial_schema.sql`,
  `supabase/migrations/20260709000000_refund_payment_function.sql`,
  `supabase/migrations/20260717000001_refund_payment_sets_order_refunded.sql`
- Escalate: security-auditor + supabase-schema-architect

### #37 — Order status route has no role check
**Status:** assigned together with #36 (same developer)

API-layer companion to #36. Confirmed as a **regression against the team's own plan** —
`docs/superpowers/plans/2026-07-09-kitchen-dashboard.md` line 17 explicitly required this check;
it was never implemented.

- Fix: add role + restaurant-membership check to `apps/web/app/api/orders/[orderId]/status/route.ts`
  (mirror the pattern in `apps/web/app/api/payments/[paymentId]/refund/route.ts`)
- **Critical-path note:** must land together with #36 — fixing only the API layer leaves the
  RPC endpoint itself still exploitable.

---

## P2 — Real gaps, not blocking, priority order below

1. **#53** — Manager dashboard has no order drill-down. Bonus finding: `GET /api/orders/{orderId}`
   is documented in README/spec but doesn't exist. Small, self-contained, no schema change.
   Files: `apps/web/app/(manager)/manager/page.tsx`, needs new `apps/web/app/api/orders/[orderId]/route.ts`.
2. **#57** — `order_sessions` never auto-expire; table QR stays "occupied" after guests leave.
   Cheapest fix: staleness indicator on staff dashboard, no schema change. Full TTL/cron auto-expiry
   is a bigger optional follow-up.
3. **#47** — Security audit: Next.js/postcss CVEs need a version bump; no CORS allowlist on API
   routes. Two independent, low-risk fixes. Unrelated to #36/#37 (different layer).
4. **#49** — Icon-only buttons missing `aria-label` in `MenuManagementTab.tsx`. Valid finding, but
   the issue's cited line numbers are stale (recent UI churn) — same file, correct fix needed at
   different lines (~305, 386, 474, 538 as of this triage).
5. **#46** — Push notifications for order updates. No toast/sound/push layer exists anywhere today.
   Recommend scoping to in-app toast+sound first, not full Web Push (separate, bigger ask).
6. **#56** — Order confirmation page with order number + est. prep time. Blocked on a product
   decision — neither field has backing schema today. The issue's suggested `GET /api/orders/{orderId}`
   reuse doesn't exist either (same gap as #53).

---

## P3 — Deferred / recommend closing

- **#54** — Customer rating/feedback system. Entirely new feature area, no schema/spec support.
  Needs a `feature-spec.md` amendment before any code (per CLAUDE.md's rule against introducing
  untracked tables).
- **#48** — SEO audit. Cited file (`feature-overview.html`) is an internal planning doc, never
  served to users — wrong target. App is almost entirely auth-gated; SEO has minimal product value.
  Recommend closing as `invalid`.
- **#59** — "Critical race conditions in payment flow." Describes a Stripe-webhook/idempotency-key
  architecture that doesn't exist in this codebase. Real underlying gap is already tracked by #36.
  Recommend closing as `invalid` with a pointer to #36.

## Needs info — hold, don't schedule

- **#52 — "Respond time"** — single vague sentence, no repro, no page/role/environment named.
  `ROOT_CAUSE: insufficient evidence`. Needs reproduction details from reporter before triage can
  continue.

---

## Fold-into-existing-plan candidates
Per this repo's convention of folding bug fixes into relevant feature plans:
- #53's drill-down → fold into a future Manager dashboard plan
- #57's staleness indicator → fold into `restaurant-management.md`'s table-session scope

## Not yet done (pending decision)
- No labels applied
- No board tickets created for P2 items
- No "needs more info" comment posted to #52
- No close-as-invalid comments posted to #48/#59
