# Workflow Index

This document tracks all implementation workflows for the Restaurant QR Order System.

## Workflows

| # | Workflow | Status | Description |
|---|----------|--------|-------------|
| 1 | [Test Infrastructure](workflows/plan-1.md) | ✅ Done | Jest, Playwright, RLS test harness |
| 2 | [DB Schema Verification & Storage](workflows/plan-2.md) | ✅ Done | Schema verification, RLS tests, storage buckets, QR generation |

## Workflow Relationships

```mermaid
graph TD
    W1[Workflow 1: Test Infrastructure] --> W2[Workflow 2: DB Schema]
    W1 --> W3[Workflow 3: Auth & Middleware]
    W1 --> W4[Workflow 4: Customer Ordering]
    W1 --> W5[Workflow 5: Kitchen Dashboard]
    W1 --> W6[Workflow 6: Staff Dashboard]
    W1 --> W7[Workflow 7: Payments & Cashier]
    W1 --> W8[Workflow 8: Owner Features]
    W1 --> W9[Workflow 9: Restaurant Management]

    W2 --> W3
    W3 --> W4
    W3 --> W5
    W3 --> W6
    W3 --> W7
    W3 --> W8
    W3 --> W9

    style W1 fill:#c8e6c9
    style W2 fill:#c8e6c9
```

## Dependency Chain

All workflows depend on **Workflow 1 (Test Infrastructure)** being complete first, as it provides the testing harness required by later workflows. **Workflow 2 (DB Schema)** must complete before any feature workflow that touches database tables.

## Status Summary

- **Completed:** Workflows 1–2 (test infrastructure, schema verification)
- **Pending:** Workflows 3–9 (auth, features, dashboards)
