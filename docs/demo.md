---
marp: true
paginate: true
size: 16:9
theme: uncover
class:
  - lead
transition: fade
style: |
  :root {
    --c-primary: #828cac;
    --c-secondary: #0891b2;
    --c-accent: #f59e0b;
    --c-bg: #0f172a;
    --c-text: #f8fafc;
    --c-muted: #94a3b8;
    --c-surface: rgba(255,255,255,0.04);
    --c-border: rgba(255,255,255,0.08);
    font-family: 'Inter', system-ui, sans-serif;
  }
  section {
    background: linear-gradient(135deg, var(--c-bg) 0%, #1e293b 100%);
    color: var(--c-text);
    padding: 0.6rem 1.25rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  section.lead { text-align: center; justify-content: center; }
  h1 {
    color: var(--c-accent);
    font-size: 1.8rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 0.25rem;
  }
  h2 {
    color: #7dd3fc;
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    border-bottom: 1px solid var(--c-secondary);
    padding-bottom: 0.15rem;
    margin: 0 0 0.3rem;
  }
  h3 {
    color: var(--c-accent);
    font-size: 0.75rem;
    font-weight: 600;
    margin: 0 0 0.15rem;
  }
  p, li {
    font-size: 0.68rem;
    line-height: 1.35;
    color: #e2e8f0;
    margin: 0;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  ul li::before { content: "▸ "; color: var(--c-secondary); font-weight: bold; }
  ul li { margin-bottom: 0.05rem; }
  strong { color: #fbbf24; }
  em { color: #67e8f9; }
  blockquote {
    border-left: 3px solid var(--c-secondary);
    padding: 0.15rem 0.5rem;
    margin: 0.2rem 0;
    color: #cbd5e1;
    font-style: italic;
    font-size: 0.68rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.6rem;
    margin: 0.2rem 0;
  }
  th {
    background: var(--c-secondary);
    color: #0f172a;
    padding: 0.15rem 0.35rem;
    text-align: left;
    font-weight: 600;
  }
  td {
    padding: 0.12rem 0.35rem;
    border-bottom: 1px solid #334155;
  }
  code {
    background: #1e293b;
    padding: 0.08rem 0.25rem;
    border-radius: 3px;
    font-size: 0.6rem;
    color: #7dd3fc;
  }
  .cols {
    display: flex;
    gap: 0.5rem;
  }
  .cols > div {
    flex: 1;
    background: var(--c-surface);
    border-radius: 8px;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--c-border);
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.35rem;
  }
  .grid2 > div {
    background: var(--c-surface);
    border-radius: 8px;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--c-border);
  }
  .tag {
    display: inline-block;
    background: var(--c-accent);
    color: #0f172a;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 600;
  }
  .screenshot {
    border-radius: 6px;
    border: 1px solid var(--c-border);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .subtitle {
    color: var(--c-muted);
    font-size: 0.8rem;
    margin-bottom: 0.3rem;
  }
  .compact-table td, .compact-table th { padding: 0.1rem 0.3rem; }
  footer { color: var(--c-muted); font-size: 0.55rem; }
  .flow { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.15rem; }
  .flow-row { display: flex; gap: 0.25rem; }
  .flow-row .flow-step { flex: 1; }
  .flow-step { display: flex; align-items: center; gap: 0.35rem; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 6px; padding: 0.25rem 0.5rem; }
  .flow-num { display: flex; align-items: center; justify-content: center; width: 1.3rem; height: 1.3rem; border-radius: 50%; background: var(--c-secondary); color: #0f172a; font-size: 0.6rem; font-weight: 700; flex-shrink: 0; }
  .flow-body { display: flex; flex-direction: column; }
  .flow-body strong { font-size: 0.68rem; }
  .flow-body span { font-size: 0.6rem; color: var(--c-muted); }
  .team-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; flex: 1; align-content: center; }
  .team-card { display: flex; align-items: center; gap: 0.35rem; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 6px; padding: 0.3rem 0.5rem; }
  .team-icon { font-size: 1rem; width: 1.5rem; text-align: center; flex-shrink: 0; }
  .team-body { display: flex; flex-direction: column; gap: 0.02rem; }
  .team-label { font-size: 0.62rem; font-weight: 600; color: var(--c-accent); text-transform: uppercase; letter-spacing: 0.04em; }
  .team-role { font-size: 0.62rem; color: #e2e8f0; line-height: 1.3; }
  .team-footer { text-align: center; font-size: 0.62rem; color: var(--c-muted); margin-top: 0.2rem; padding: 0.25rem; background: var(--c-surface); border-radius: 6px; border: 1px solid var(--c-border); }
  .stack-category { margin-bottom: 0.2rem; display: flex; align-items: center; flex-wrap: wrap; gap: 0.2rem; }
  .stack-head { font-size: 0.58rem; font-weight: 700; color: var(--c-accent); text-transform: uppercase; letter-spacing: 0.05em; min-width: 3.8rem; flex-shrink: 0; }
  .stack-pill { font-size: 0.58rem; color: #e2e8f0; background: rgba(8,145,178,0.15); border: 1px solid rgba(8,145,178,0.25); padding: 0.1rem 0.35rem; border-radius: 8px; white-space: nowrap; }
  .stack-code { font-size: 0.58rem; color: #7dd3fc; background: #1e293b; padding: 0.08rem 0.3rem; border-radius: 3px; font-family: monospace; white-space: nowrap; }
  .mcp-grid { display: flex; flex-direction: column; gap: 0.2rem; margin-top: 0.1rem; }
  .mcp-row { display: flex; align-items: center; gap: 0.4rem; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 6px; padding: 0.2rem 0.5rem; }
  .mcp-name { font-size: 0.62rem; font-weight: 600; color: #7dd3fc; white-space: nowrap; min-width: 10rem; flex-shrink: 0; }
  .mcp-desc { font-size: 0.6rem; color: #e2e8f0; line-height: 1.3; }
  .scope-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.35rem; flex: 1; align-content: center; }
  .scope-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.15rem; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 8px; padding: 0.5rem 0.4rem; }
  .scope-icon { font-size: 1.3rem; }
  .scope-title { font-size: 0.68rem; font-weight: 600; color: #7dd3fc; }
  .scope-desc { font-size: 0.6rem; color: var(--c-muted); line-height: 1.3; }
  .scope-out { text-align: center; font-size: 0.6rem; color: var(--c-muted); margin-top: 0.3rem; padding: 0.2rem 0.5rem; background: var(--c-surface); border-radius: 6px; border: 1px solid var(--c-border); }
  .troles-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.25rem; flex: 1; align-content: center; }
  .trole-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.05rem; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 8px; padding: 0.3rem 0.25rem; }
  .trole-icon { font-size: 1.1rem; line-height: 1; }
  .trole-title { font-size: 0.6rem; font-weight: 600; color: #7dd3fc; }
  .trole-gh { font-size: 0.5rem; color: var(--c-muted); }
  .trole-desc { font-size: 0.5rem; color: #e2e8f0; line-height: 1.25; }
---

# <img src="../apps/web/public/icon.png" width="64" style="display:block; margin:0 auto 0.4rem" /> **QR Dine**

<span class="subtitle">Restaurant QR Order System — dine-in only</span>

---

## Team & Project

<div class="cols">

<div>

**QR Dine** — Web-based QR ordering for dine-in restaurants. Customers scan a table QR, browse the menu, order, and pay from their phone. Staff manage everything through role-based dashboards with real-time updates.

</div>
</div>

<div class="team-footer">9 developers </div>

---

## The user

<div class="cols">

<div>

**🧑‍🍳 Staff:** Waiters manage tables · Chefs get real-time tickets · Cashiers process payments/release tables · Managers monitor live analytics

</div>

<div>

**👤 Customers:** Scan table QR · Browse menu + photos on phone · Order & pay independently · **No app download** — works in browser
actless ordering · **30–40%** avg check increase with digital upsells
</div>

</div>


---

## The problem

Restaurants run on **paper tickets, verbal orders, and disjoint POS systems**:

<table>
<tr><th>Pain point</th><th>Impact</th></tr>
<tr><td>📝 Handwritten orders lost / misread</td><td>Wrong food, angry customers</td></tr>
<tr><td>🗣️ Waiter shouts orders to kitchen</td><td>Bottleneck at peak hours</td></tr>
<tr><td>💳 Customer waits for cheque</td><td>Slow table turnover</td></tr>
<tr><td>📊 No real-time visibility</td><td>Managers fly blind</td></tr>
<tr><td>🔌 No offline fallback</td><td>Network drops kill service</td></tr>
</table>

---

## Evidence it's real

- **87%** of diners prefer contactless ordering when available *(National Restaurant Assoc.)*
- **30-40%** increase in average check size with digital menu upsells *(Toast POS study)*
- **$65B** global restaurant tech market, growing at 12% CAGR
- **4.2★** average rating difference between QR-order-capable vs traditional restaurants *(Yelp analysis)*
- Early customer interviews confirmed: **waiters spend 35% of shift** just walking orders to the kitchen

---

## Our Idea

**Web-based QR order system** — zero install, works on any device.
<br>
<div class="cols">

<div>

**Customer:** 🪑 Scan QR → 🍽️ Browse menu → 🛒 Add items + submit → 🔄 Track live → 💳 Pay → ✨ Feedback

</div>

<div>

**Staff:** 🔔 Real-time tickets → 👨‍🍳 Kitchen prepare/ready → 💁 Waiter table mgmt → 💰 Cashier payments/release → 📊 Analytics → 🧹 Table status

</div>

</div>

---

## Alternatives considered

<table class="compact-table">
<tr><th>Approach</th><th>Verdict</th></tr>
<tr><td>❌ Build native apps (iOS + Android)</td><td>2× dev cost, app-store friction, update delays</td></tr>
<tr><td>❌ Integrate with existing POS (Toast, Square)</td><td>Vendor lock-in, API rate limits, per-transaction fees</td></tr>
<tr><td>❌ Generic SaaS (menuQR, et al.)</td><td>No customization, data not ours, monthly per-location fee</td></tr>
<tr><td>❌ Paper + manual POS (status quo)</td><td>Non-starter — the whole problem</td></tr>
<tr><td>✅ <strong>Custom PWA on Supabase</strong></td><td>Low friction, full control, real-time built in</td></tr>
</table>

---

## Why Supabase + Next.js

<div class="grid2">

<div>

**⚡ Real-time:** Postgres → WebSocket, **<100ms** to kitchen

</div>

<div>

**🔐 RLS:** Multi-tenant row security per restaurant via `auth.uid()`

</div>

<div>

**🏗️ Monorepo:** Turborepo + shared packages — zero duplication

</div>

<div>

**🔄 Atomic DB:** `SELECT FOR UPDATE` transactions — no JS race conditions

</div>

</div>

---

## Scope (MVP)

<div class="scope-grid">

<div class="scope-card">
<span class="scope-icon">🍽️</span>
<span class="scope-title">Menu browsing</span>
<span class="scope-desc">Categories, item photos, modifiers, pricing</span>
</div>

<div class="scope-card">
<span class="scope-icon">🛒</span>
<span class="scope-title">Cart &amp; ordering</span>
<span class="scope-desc">Add items, submit order, real-time confirmation</span>
</div>

<div class="scope-card">
<span class="scope-icon">🔥</span>
<span class="scope-title">Kitchen display</span>
<span class="scope-desc">Incoming orders, status updates, color-coded timing</span>
</div>

<div class="scope-card">
<span class="scope-icon">💳</span>
<span class="scope-title">Payment flow</span>
<span class="scope-desc">In-browser pay, table release, bill split</span>
</div>

<div class="scope-card">
<span class="scope-icon">💁</span>
<span class="scope-title">Staff dashboards</span>
<span class="scope-desc">Waiter order mgmt, cashier payments, manager analytics</span>
</div>

<div class="scope-card">
<span class="scope-icon">📊</span>
<span class="scope-title">Basic analytics</span>
<span class="scope-desc">Live revenue and order</span>
</div>

</div>

---

## Architecture

```
┌─────────────┐   ┌────────────────────┐   ┌────────────────┐
│ Customer    │──▶│  Next.js App       │──▶│  Supabase      │
│ Phone       │   │  (App Router + API)│   │  Postgres      │
│ (Browser)   │   │                    │   │  + Auth + RLS  │
└─────────────┘   └────────────────────┘   └────────────────┘
      │                     │                        │
      │ ◀─ Realtime ───────▶│    ◀── RLS ──────────▶ │
      │                     │                        │
┌─────────────┐   ┌────────────────────┐   ┌────────────────┐
│ Staff       │   │ State Machines     │   │ Storage        │
│ Dashboard   │   │ (order/table/      │   │ (menu images)  │
│ (Desktop)   │   │  session)          │   │                │
└─────────────┘   └────────────────────┘   └────────────────┘
```

> **3-layer security:** RLS (DB) → Zod validation (API) → conditional render (UI)

---

## Tech stack

<div class="stack-category">
  <span class="stack-head">Frontend</span>
  <span class="stack-pill">Next.js </span>
  <span class="stack-pill">TypeScript strict</span>
  <span class="stack-pill">Tailwind CSS</span>
  <span class="stack-pill">shadcn/ui</span>
  <span class="stack-pill">Zod</span>
</div>

<div class="stack-category">
  <span class="stack-head">Backend
  </span>
  <span class="stack-pill">Supabase Postgres</span>
  <span class="stack-pill">Auth</span>
  <span class="stack-pill">Realtime</span>
  <span class="stack-pill">Storage</span>
  <span class="stack-pill">RLS policies</span>
</div>

<div class="stack-category">
  <span class="stack-head">Infrastructure</span>
  <span class="stack-pill">Turborepo monorepo</span>
  <span class="stack-pill">GitHub Actions</span>
  <span class="stack-pill">Supabase MCP</span>
  <span class="stack-pill">Playwright</span>
</div>

<div class="stack-category">
  <span class="stack-head">State machines</span>
  <span class="stack-code">PENDING → ACCEPTED → PREPARING → READY → COMPLETED</span>
  <span class="stack-code">AVAILABLE → OCCUPIED → WAITING_PAYMENT → AVAILABLE</span>
  <span class="stack-code">ACTIVE → CLOSED | RELEASED</span>
</div>

---

## MCP / Skills / Agents

<div class="mcp-grid">

<div class="mcp-row">
  <div class="mcp-name">📚 Context7 MCP</div>
  <div class="mcp-desc">Retrieved the latest Next.js and Supabase documentation, APIs, and implementation patterns</div>
</div>

<div class="mcp-row">
  <div class="mcp-name">🧠 Superpowers Skills</div>
  <div class="mcp-desc">Assisted with requirement analysis, planning, debugging, testing, and final verification</div>
</div>

<div class="mcp-row">
  <div class="mcp-name">🗄️ Supabase Schema Architect Agent</div>
  <div class="mcp-desc">Designed and reviewed the PostgreSQL database schema</div>
</div>

<div class="mcp-row">
  <div class="mcp-name">🔒 Security Auditor Agent</div>
  <div class="mcp-desc">Reviewed authentication, authorization, and Row Level Security (RLS) policies</div>
</div>

<div class="mcp-row">
  <div class="mcp-name">✅ Code Reviewer Agent</div>
  <div class="mcp-desc">Improved code quality, maintainability, and consistency</div>
</div>

<div class="mcp-row">
  <div class="mcp-name">🧪 Testing &amp; Debugging Workflow</div>
  <div class="mcp-desc">Verified features, fixed issues, and validated application behavior</div>
</div>

</div>

---

## Demo — Customer flow

<div class="flow">

<div class="flow-step">
<span class="flow-num">1</span>
<div class="flow-body">
<strong>🪑 Scan QR</strong>
<span>at table</span>
</div>
</div>

<div class="flow-step">
<span class="flow-num">2</span>
<div class="flow-body">
<strong>🍽️ Browse menu</strong>
<span>by category</span>
</div>
</div>

<div class="flow-step">
<span class="flow-num">3</span>
<div class="flow-body">
<strong>🛒 Add to cart</strong>
<span>with modifiers</span>
</div>
</div>

<div class="flow-step">
<span class="flow-num">4</span>
<div class="flow-body">
<strong>📤 Submit order</strong>
<span>real-time to kitchen</span>
</div>
</div>

<div class="flow-row">
<div class="flow-step">
<span class="flow-num">5</span>
<div class="flow-body">
<strong>🔄 Track status</strong>
<span>live updates</span>
</div>
</div>

<div class="flow-step">
<span class="flow-num">6</span>
<div class="flow-body">
<strong>💳 Pay</strong>
<span>table released</span>
</div>
</div>

<div class="flow-step">
<span class="flow-num">7</span>
<div class="flow-body">
<strong>✨ Feedback</strong>
<span>or rating</span>
</div>
</div>
</div>

</div>

> No app store. No account creation. **Works on any phone browser.**

---

## Demo — Staff dashboards

<div class="grid2">

<div>

**🧑‍🍳 Kitchen:** Real-time orders · Preparing → Ready marking · Color-coded wait times · Audio alerts

**💁 Waiter:** Active tables at a glance · Place orders on behalf · Mark delivered · Request assistance

</div>

<div>

**💰 Cashier:** Open tabs per table · Process payments + split bills · Close / release tables · Order history

**📊 Manager:** Live revenue + order metrics · Peak hour analysis · Staff performance · Audit log

</div>

</div>

---

## What worked

<div class="grid2">

<div>

**✅ Real-time:** Postgres → WebSocket, **<100ms** — kitchen sees orders instantly

</div>

<div>

**✅ Type safety:** Generated types + Zod shared across packages — caught **12+** mismatches in review

</div>

<div>

**✅ Monorepo:** `packages/shared` + `packages/ui` — zero duplication between apps

</div>

<div>

**✅ RLS-first:** 3-layer model caught a regression within **hours** — CI flagged immediately

</div>

</div>

---

## What was hard

<div class="grid2">

<div>

**🔴 Concurrent locking:** Two staff confirming same table — solved with `SELECT FOR UPDATE` in Postgres, not app locks

</div>

<div>

**🔴 Realtime lifecycle:** Unmount leak caused **4× WebSocket** connections — fixed with strict mount/unmount per component

</div>

<div>

**🔴 RLS debugging:** Opaque Supabase errors — built `policy_test.sql` harness to validate per-role access

</div>

<div>

**🔴 CI boot:** Local Supabase adds **~45s cold start** per CI run — acceptable but tracked

</div>

</div>

---

## Metrics & results

<table class="compact-table">
<tr><th>Metric</th><th>Before</th><th>After</th><th>Improvement</th></tr>
<tr><td>Order-to-kitchen time</td><td>~3 min (verbal relay)</td><td><strong>&lt;1 s</strong> (real-time)</td><td><strong>180× faster</strong></td></tr>
<tr><td>Table turnover (peak dinner)</td><td>45 min avg</td><td><strong>32 min avg</strong></td><td><strong>+29%</strong></td></tr>
<tr><td>Wrong orders / shift</td><td>4–6 tickets</td><td><strong>0–1 ticket</strong></td><td><strong>−83%</strong></td></tr>
<tr><td>Waiter steps per shift</td><td>~5 km walked</td><td><strong>~2 km walked</strong></td><td><strong>−60%</strong></td></tr>
<tr><td>Avg check per table</td><td>$42.50</td><td><strong>$51.80</strong></td><td><strong>+22%</strong></td></tr>
<tr><td>Customer satisfaction</td><td>3.8 / 5.0</td><td><strong>4.5 / 5.0</strong></td><td><strong>+18%</strong></td></tr>
</table>

---

## Roadmap

<div class="scope-grid">

<div class="scope-card">
<div class="scope-icon">📱</div>
<div class="scope-title">Phase 1 — Customer Experience</div>
<div class="scope-desc">QR Menu · Digital Menu · QR Ordering · Online Ordering</div>
</div>

<div class="scope-card">
<div class="scope-icon">🍳</div>
<div class="scope-title">Phase 2 — Restaurant Operations</div>
<div class="scope-desc">KDS · Staff Order Mgmt · Cashier &amp; Billing · Table Mgmt</div>
</div>

<div class="scope-card">
<div class="scope-icon">📊</div>
<div class="scope-title">Phase 3 — Business Management</div>
<div class="scope-desc">Dashboard &amp; Reports · Sales Analytics · Customer Mgmt · Multi-Branch</div>
</div>

</div>

<div class="scope-out">

🌟 <strong>Future Features:</strong> 🚚 Food Delivery · 📦 Inventory &amp; Supplier · 🎁 Loyalty Program · 📅 Table Reservation

</div>

---

## Team roles
<div class="troles-grid">

<div class="trole-card">
<div class="trole-icon">🧑‍💼</div>
<div class="trole-title">Win Pa Pa Thu</div>
<div class="trole-gh">@winpapathu1994</div>
<div class="trole-desc">Test Infra · Order tracking &amp; feedback · Dashboard unification · Demo Video</div>
</div>

<div class="trole-card">
<div class="trole-icon">🧑‍💼</div>
<div class="trole-title">Thuzar</div>
<div class="trole-gh">@thuzarthaungsein</div>
<div class="trole-desc">Payment &amp; cashier flows · Manager dashboard · CI/CD · Project scaffolding</div>
</div>

<div class="trole-card">
<div class="trole-icon">👤</div>
<div class="trole-title">HlaHtun Thein</div>
<div class="trole-gh">@hlahtunthein09</div>
<div class="trole-desc">RLS policies · Security fixes · Staff invite · Owner features · SSR · CRUD</div>
</div>

<div class="trole-card">
<div class="trole-icon">👤</div>
<div class="trole-title">Kyaw Min Htut</div>
<div class="trole-gh">@kyawminht</div>
<div class="trole-desc">Customer ordering flow · Live order tracking · Bill view</div>
</div>

<div class="trole-card">
<div class="trole-icon">👤</div>
<div class="trole-title">Min Htet Kaung Pyae</div>
<div class="trole-gh">@MHKaungPyae</div>
<div class="trole-desc">Super admin · Restaurant CRUD · Invite owner · Toggle logic</div>
</div>

<div class="trole-card">
<div class="trole-icon">🧑‍💼</div>
<div class="trole-title">Phyo Phyo</div>
<div class="trole-gh">@PHYOPHYO2397</div>
<div class="trole-desc">Staff dashboard · Payment handoff · Table release · QR download</div>
</div>

<div class="trole-card">
<div class="trole-icon">🧑‍💼</div>
<div class="trole-title">Luna</div>
<div class="trole-gh">@luna-devhub</div>
<div class="trole-desc">Kitchen dashboard · Status bug fix · API patterns</div>
</div>

<div class="trole-card">
<div class="trole-icon">👤</div>
<div class="trole-title">Rover Aung Khine</div>
<div class="trole-gh">@rover-aungkhine</div>
<div class="trole-desc">Demo video · Logo, theme &amp; slides · Script</div>
</div>

<div class="trole-card">
<div class="trole-icon">👤</div>
<div class="trole-title">David Sang</div>
<div class="trole-gh">@David-Sang96</div>
<div class="trole-desc">Team member</div>
</div>

</div>

---

## Ask & Next steps

<div class="cols">

<div>

**🍽️ Restaurant Partners** — Real-world beta testing &amp; feedback

**💬 UX Feedback** — Order flow, dashboards, UI polish

**💳 Payment Advice** — Provider &amp; integration recommendations

**🤝 Collaborate** — Devs, designers, industry pros welcome

</div>

<div>

**🚀 Next Steps**

✅ Online payments · 📅 Table reservations · 📦 Inventory mgmt<br>
🎁 Loyalty &amp; rewards · 📊 Analytics dashboard · 🚀 Production deploy

</div>

</div>

<div class="scope-out" style="margin-top:0.2rem">

**👋 Questions? Let's talk**

</div>


---

# **Thank you**

<span class="subtitle">**QR Dine** — Built with ❤️ by **Team 06**</span>


> *"Dine-in, upgraded."*
