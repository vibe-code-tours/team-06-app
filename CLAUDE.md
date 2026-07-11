# CLAUDE.md

Guidance for Claude Code (and any subagents) working in this repository.

## Project

Restaurant QR Order System — customers scan a table QR code, browse the menu, order,
and pay from their phone. Staff manage everything through role-based dashboards with
real-time updates.

Source of truth for requirements, in priority order:

1. `feature-spec.md` — features, roles, permission matrix, API contracts, Definition of Done
2. `tech-stack.md` — stack decisions, schema/enum reference, security model
3. `monorepo-structure.md` — directory layout, package boundaries
4. `order.txt` — condensed summary, use only to cross-check the above

Do not introduce a technology, table, enum, or role not listed in these files without
flagging it explicitly in your response first.

## Stack (fixed — do not change without explicit instruction)

- Next.js (App Router) + TypeScript (strict mode)
- Supabase: Postgres, Auth, Realtime, Storage
- Tailwind CSS + shadcn/ui
- Zod for all input validation
- react-hook-form for forms
- Turborepo monorepo: `apps/web`, `apps/api` (optional), `packages/shared`, `packages/ui`

## Architecture rules

- **Handlers stay thin.** Route handlers in `app/api/**` validate input (Zod) and call a
  service function. No business logic, no direct multi-table writes in the handler itself.
- **Services own business logic.** Anything touching order state transitions, session
  locking, or payment math belongs in a service, not scattered across components or routes.
- **Repositories/data access are isolated** from services — services should not construct
  raw Supabase queries inline if the same query shape is used in more than one place.
- **Atomic operations stay in Postgres functions**, not application code:
  `create_order_with_session()`, `update_order_status()`, `process_payment()`,
  `release_table()`. These use `SELECT FOR UPDATE` / transactions to prevent race
  conditions — never reimplement this locking in JS.
- **Every mutation is permission-checked at three layers**: RLS policy (DB), route handler
  (API), and conditional rendering (UI) — per `feature-spec.md` §11. A feature isn't done
  until all three are verified for its resource.
- **Realtime subscriptions** are mounted in the component that needs them and torn down on
  unmount. Always include a polling fallback per the spec's cross-cutting requirements.

## Code style

- TypeScript strict mode everywhere; no `any` without a comment explaining why.
- camelCase for variables/functions, PascalCase for components/classes/types,
  snake_case for database columns and Postgres identifiers (matches Supabase generated types).
- 4-space indentation, no semicolons, trailing commas allowed — match existing files.
- All API inputs validated with Zod schemas from `lib/validators/` (web) or
  `packages/shared/src/validators/` (shared).
- No secrets in code. `SUPABASE_SERVICE_ROLE_KEY` is server-only, never imported into a
  client component or exposed to the browser bundle.

## Database & RLS

- Every table has RLS enabled — no exceptions, including new tables added later.
- Role checks go through `user_has_role()` / `user_belongs_to_restaurant()` — don't inline
  ad-hoc role logic in policies.
- Any schema change requires a new migration file in `supabase/migrations/`; never hand-edit
  a prior migration that's already been applied.
- After a schema change, regenerate types: `npm run types:generate`.

## State machines — enforce, don't assume

- Order status: `PENDING → ACCEPTED → PREPARING → READY → COMPLETED`, with `CANCELLED`
  reachable from any pre-COMPLETED state. Skipping states must be rejected at the DB layer
  (`update_order_status()`), not just the UI.
- Table status: `AVAILABLE → OCCUPIED → WAITING_PAYMENT → AVAILABLE`, with `CLEANING` as a
  branch from `WAITING_PAYMENT`.
- Session status: `ACTIVE → CLOSED` (on payment) or `ACTIVE → RELEASED` (manual staff action).
- Only one `ACTIVE` session per table. New orders against a table with an active unpaid
  session must be blocked, not queued.

## Testing expectations

- Unit tests (Jest) for every DB function's application-layer wrapper and for services.
- Integration tests for RLS: each of the 7 roles tested against each resource in the
  permission matrix — this is the easiest thing to skip under time pressure; don't.
- E2E (Playwright or similar) for: customer order flow, kitchen status flow, payment flow,
  concurrent-order session locking.

## Working across the 9-developer team

This repo is being built by multiple people/agents in parallel workstreams:
DB/backend core, API layer, customer-facing UI, staff/kitchen/cashier dashboards, and
platform/DevOps. Before changing a shared file (`packages/shared/**`, migrations, or
generated types), check for open PRs touching the same area — these are the most likely
collision points.

## MCP tools available in this project

- **Supabase MCP** — schema inspection, migrations, SQL execution, type generation,
  security advisor checks. Scoped to a **development** project via `project_ref`; never
  point this at production. Treat it as service-role/admin-level access — confirm before
  any destructive or write operation.
- **GitHub MCP** — PRs, issues, CI status.

## Definition of Done

A feature is not complete until it satisfies the corresponding checklist item(s) in
`feature-spec.md` under "Definition of Done" — including RLS policy, API validation,
realtime update, and accessibility requirements where applicable. Treat that section as
the acceptance criteria, not a nice-to-have.

## Documentation Maintenance

Whenever an implementation plan under `docs/superpowers/plans/` is completed (status: done):

1. Update the affected workflow document under `docs/workflows/`.
2. Update `docs/workflow.md` if the workflow index or relationships have changed.
3. Synchronize all Mermaid diagrams with the implemented behavior.
4. Preserve unrelated documentation.
5. Remove obsolete TODOs and planned behavior.
6. Ensure the documentation reflects the current implementation rather than the original plan.
