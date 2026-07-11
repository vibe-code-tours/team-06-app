# Workflow: Database Schema Verification & Storage Setup

## Overview

This workflow documents the verification of the existing database schema against `feature-spec.md` and `tech-stack.md`, addition of storage buckets, real QR code generation, and comprehensive RLS/business-function test coverage.

## Status: ✅ Complete

## Workflow Diagram

```mermaid
flowchart TD
    A[Start: DB Schema Verification] --> B[Task 1: Apply Migrations & Generate Types]
    B --> C[Task 2: Schema Shape Tests]
    C --> D[Task 3: RLS Tests — Profiles & Restaurants]
    D --> E[Task 4: RLS Tests — Menu, Tables, Orders, Payments]
    E --> F[Task 5: Business Function Tests]
    F --> G[Task 6: Fix RLS/Function Bugs]
    G --> H[Task 7: Storage Buckets Migration]
    H --> I[Task 8: QR Code Generation]
    I --> J[Task 9: Dev Seed Data]
    J --> K[Verification & Documentation]

    B --> B1[Reset local DB]
    B1 --> B2[Generate TypeScript types]
    B2 --> B3[Verify compilation]

    C --> C1[Query all 9 tables]
    C1 --> C2[Verify enum constraints]

    D --> D1[Profiles cross-tenant isolation]
    D1 --> D2[Super-admin cross-restaurant read]
    D2 --> D3[Kitchen staff insert denial]
    D3 --> D4[Restaurant read filtering]
    D4 --> D5[Manager update denial]
    D5 --> D6[Owner update success]

    E --> E1[Menu item visibility by role]
    E1 --> E2[Table status update permissions]
    E2 --> E3[Session view by staff]
    E3 --> E4[Order status update permissiveness]
    E4 --> E5[Cross-restaurant order_item isolation]
    E5 --> E6[Payment visibility by role]
    E6 --> E7[Cashier payment insert]

    F --> F1[create_order_with_session]
    F1 --> F2[update_order_status transitions]
    F2 --> F3[process_payment atomicity]
    F3 --> F4[release_table cleanup]

    G --> G1{Bugs found?}
    G1 -->|Yes| G2[Patch migration]
    G1 -->|No| G3[Skip]

    H --> H1[Create storage buckets migration]
    H1 --> H2[restaurant-logos bucket]
    H2 --> H3[menu-images bucket]
    H3 --> H4[Storage RLS policies]

    I --> I1[Install qrcode package]
    I1 --> I2[Implement generateTableQrDataUrl]
    I2 --> I3[Write and verify test]

    J --> J1[Create seed.sql]
    J1 --> J2[Restaurant + categories + menu + tables]
```

## Task Dependencies

```mermaid
graph LR
    T1[Task 1: Migrations & Types] --> T2[Task 2: Schema Shape]
    T2 --> T3[Task 3: RLS Profiles/Restaurants]
    T3 --> T4[Task 4: RLS Menu/Tables/Orders/Payments]
    T4 --> T5[Task 5: Business Functions]
    T5 --> T6[Task 6: Bug Fixes]
    T6 --> T7[Task 7: Storage Buckets]
    T7 --> T8[Task 8: QR Code]
    T8 --> T9[Task 9: Seed Data]
```

## Migration Chain

```mermaid
graph TD
    M1[20250706000000_initial_schema.sql<br/>9 tables, 7 enums, 35+ RLS policies] --> M2[20250710000000_fix_rls_infinite_recursion.sql]
    M2 --> M3[20250711000000_grant_service_role_permissions.sql<br/>service_role + anon + authenticated GRANTs]
    M3 --> M4[20260708000001_grant_authenticated_write_permissions.sql<br/>Missing INSERT/UPDATE/DELETE for authenticated]
    M4 --> M5[20260708020000_storage_buckets.sql<br/>restaurant-logos + menu-images + 8 policies]

    style M1 fill:#e1f5fe
    style M4 fill:#fff3e0
    style M5 fill:#e8f5e9
```

## Test Coverage Matrix

```mermaid
graph TD
    subgraph "Schema Shape (10 tests)"
        S1[9 table queryable probes]
        S2[1 enum rejection test]
    end

    subgraph "RLS Policies (16 tests)"
        R1[profiles: 3 tests]
        R2[restaurants: 3 tests]
        R3[menu: 3 tests]
        R4[tables/sessions: 3 tests]
        R5[orders/items: 2 tests]
        R6[payments: 2 tests]
    end

    subgraph "Business Functions (10 tests)"
        B1[create_order_with_session: 3]
        B2[update_order_status: 4]
        B3[process_payment: 2]
        B4[release_table: 1]
    end

    subgraph "Storage (4 tests)"
        ST1[bucket existence]
        ST2[owner upload]
        ST3[waiter upload denial]
        ST4[public read]
    end

    subgraph "QR Code (1 test)"
        Q1[generateTableQrDataUrl]
    end

    S1 --> TOTAL[Total: 41 tests]
    S2 --> TOTAL
    R1 --> TOTAL
    R2 --> TOTAL
    R3 --> TOTAL
    R4 --> TOTAL
    R5 --> TOTAL
    R6 --> TOTAL
    B1 --> TOTAL
    B2 --> TOTAL
    B3 --> TOTAL
    B4 --> TOTAL
    ST1 --> TOTAL
    ST2 --> TOTAL
    ST3 --> TOTAL
    ST4 --> TOTAL
    Q1 --> TOTAL
```

## Issues Found & Fixed

```mermaid
graph TD
    I1[Issue: authenticated role missing write GRANTs] --> F1[Fix: New migration 20260708000001]
    I2[Issue: seedTestData email collisions] --> F2[Fix: Monotonic counter for unique emails]
    I3[Issue: Auth API transient failures] --> F3[Fix: Retry logic in helpers]
    I4[Issue: Storage Blob MIME type] --> F4[Fix: Use File instead of Blob]

    F1 --> V1[All RLS tests pass]
    F2 --> V1
    F3 --> V1
    F4 --> V2[All storage tests pass]
```

## File Structure

```mermaid
graph TD
    subgraph "New Migrations"
        M4[20260708000001_grant_authenticated_write_permissions.sql]
        M5[20260708020000_storage_buckets.sql]
    end

    subgraph "Test Files"
        T1[enums-and-tables.test.ts]
        T2[rls-profiles.test.ts]
        T3[rls-restaurants.test.ts]
        T4[rls-menu.test.ts]
        T5[rls-tables-and-sessions.test.ts]
        T6[rls-orders-and-items.test.ts]
        T7[rls-payments.test.ts]
        T8[fn-create-order-with-session.test.ts]
        T9[fn-update-order-status.test.ts]
        T10[fn-process-payment-and-release-table.test.ts]
        T11[storage-buckets.test.ts]
        T12[qrCode.test.ts]
    end

    subgraph "Helpers"
        H1[resetDatabase.ts]
        H2[seedTestData.ts]
        H3[supabaseTestClient.ts]
    end

    subgraph "Generated"
        G1[database.ts types]
    end

    subgraph "Seed"
        S1[seed.sql]
    end
```

## Decision Log

| Decision | Rationale |
|----------|-----------|
| New migration for grants | Never edit applied migrations (CLAUDE.md rule) |
| Unique emails per seed call | Prevents cross-restaurant profile leakage in tests |
| Retry logic for auth API | Local Supabase returns transient 500s under load |
| `--runInBand` for test execution | Avoids auth API rate limiting from parallel tests |
| `import * as QRCode` | `@types/qrcode` has no default export |
| `File` over `Blob` for storage | Supabase storage rejects `application/octet-stream` |
| Monotonic counter in seedTestData | Ensures unique fixtures per `seedTestData()` call |

## Success Criteria

- [x] `npm run db:reset` applies all 5 migrations + seed data
- [x] `packages/shared/src/types/database.ts` exists and compiles
- [x] 41 tests pass: 10 schema + 16 RLS + 10 business functions + 4 storage + 1 QR
- [x] `generateTableQrDataUrl` works and is tested
- [x] Every RLS policy and business function has at least one test

## Related Documents

- [DB Schema Plan](../superpowers/plans/2026-07-08-db-schema.md)
- [Test Infrastructure Plan](../superpowers/plans/2026-07-08-test-infrastructure.md)
- [CLAUDE.md](../../CLAUDE.md)
