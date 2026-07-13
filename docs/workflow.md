# Workflow Index

This document tracks all implementation workflows for the Restaurant QR Order System.

## Workflows

| # | Workflow | Status | Description |
|---|----------|--------|-------------|
| 1 | [Test Infrastructure](workflows/plan-1.md) | ✅ Done | Jest, Playwright, RLS test harness |
| 2 | [DB Schema Verification & Storage](workflows/plan-2.md) | ✅ Done | Schema verification, RLS tests, storage buckets, QR generation |
| 3 | [Kitchen Dashboard](workflows/plan-3.md) | ✅ Done | API route handler, order service, polling hook, dark theme |

## Workflow Relationships

```mermaid
graph TD
    W1[Workflow 1: Test Infrastructure] --> W2[Workflow 2: DB Schema]
    W1 --> W3[Workflow 3: Kitchen Dashboard]
    W1 --> W4[Workflow 4: Customer Ordering]
    W1 --> W5[Workflow 5: Staff Dashboard]
    W1 --> W6[Workflow 6: Payments & Cashier]
    W1 --> W7[Workflow 7: Owner Features]
    W1 --> W8[Workflow 8: Restaurant Management]

    W2 --> W3
    W2 --> W4
    W2 --> W5
    W2 --> W6
    W2 --> W7
    W2 --> W8

    W3 -.-> W5
    W3 -.-> W6

    style W1 fill:#c8e6c9
    style W2 fill:#c8e6c9
    style W3 fill:#c8e6c9
```

## Dependency Chain

All workflows depend on **Workflow 1 (Test Infrastructure)** being complete first, as it provides the testing harness required by later workflows. **Workflow 2 (DB Schema)** must complete before any feature workflow that touches database tables. **Workflow 3 (Kitchen Dashboard)** establishes patterns (API routes, services) reused by later dashboards.

## Status Summary

- **Completed:** Workflows 1–3 (test infrastructure, schema verification, kitchen dashboard)
- **Pending:** Workflows 4–8 (customer ordering, staff, payments, owner, management)
