# Workflow: Test Infrastructure Implementation

## Overview

This workflow documents the implementation of the test infrastructure for the Restaurant QR Order System. It covers Jest unit/integration testing, RLS policy verification, and Playwright E2E testing.

## Workflow Diagram

```mermaid
flowchart TD
    A[Start: Test Infrastructure] --> B[Task 1: Supabase CLI Setup]
    B --> C[Task 2: Database Helpers]
    C --> D[Task 3: RLS Test Harness]
    D --> E[Task 4: Playwright E2E]
    E --> F[Task 5: Turborepo Integration]
    F --> G[Verification & Documentation]

    B --> B1[Install Supabase CLI]
    B1 --> B2[Add db:start/stop/reset scripts]
    B2 --> B3[Create .env.test template]
    B3 --> B4[Verify migration applies]

    C --> C1[Install Jest dependencies]
    C1 --> C2[Create resetDatabase helper]
    C2 --> C3[Create seedTestData helper]
    C3 --> C4[Create jest.config.ts]

    D --> D1[Create supabaseTestClient]
    D1 --> D2[Create RLS smoke test]
    D2 --> D3[Fix permission grants]

    E --> E1[Install Playwright]
    E1 --> E2[Create playwright.config.ts]
    E2 --> E3[Create smoke E2E spec]

    F --> F1[Update turbo.json]
    F1 --> F2[Update README.md]

    G --> G1[Run all tests]
    G1 --> G2[Commit changes]
```

## Task Dependencies

```mermaid
graph LR
    T1[Task 1: Supabase CLI] --> T2[Task 2: DB Helpers]
    T2 --> T3[Task 3: RLS Harness]
    T3 --> T4[Task 4: Playwright]
    T1 --> T5[Task 5: Turborepo]
    T4 --> T5
    T5 --> T6[Verification]
```

## Test Execution Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CI as CI/CD
    participant DB as Local Supabase
    participant Jest as Jest Tests
    participant PW as Playwright

    Dev->>DB: npm run db:start
    DB-->>Dev: Local stack running

    Dev->>DB: npm run db:reset
    DB-->>Dev: Migrations applied

    Dev->>Jest: npm run test
    Jest->>DB: Connect via service_role
    DB-->>Jest: Test data seeded
    Jest->>Jest: Run unit/integration tests
    Jest-->>Dev: 4 tests pass

    Dev->>PW: npm run e2e
    PW->>Dev: Start next dev server
    PW->>PW: Run E2E specs
    PW-->>Dev: 1 test pass

    CI->>DB: Setup Supabase
    CI->>Jest: Run tests
    CI->>PW: Run E2E
    CI-->>Dev: All checks pass
```

## File Structure

```mermaid
graph TD
    subgraph "Test Infrastructure"
        A[tests/helpers/supabaseTestClient.ts]
        B[tests/helpers/seedTestData.ts]
        C[tests/helpers/resetDatabase.ts]
        D[tests/rls/rls-smoke.test.ts]
        E[apps/web/jest.config.ts]
        F[apps/web/jest.setup.ts]
        G[playwright.config.ts]
        H[e2e/smoke.spec.ts]
    end

    subgraph "Configuration"
        I[supabase/.env.test]
        J[package.json]
        K[turbo.json]
    end

    subgraph "Database"
        L[supabase/migrations/]
        M[service_role GRANTs]
        N[anon/authenticated GRANTs]
    end

    A --> O[createServiceClient]
    A --> P[createAnonClient]
    A --> Q[createRoleClient]

    B --> R[seedTestData]
    B --> S[SeedFixture interface]

    C --> T[resetDatabase]
    C --> U[TABLES_IN_DELETE_ORDER]

    D --> A
    D --> B
    D --> C

    E --> F
    F --> I

    J --> K
    K --> E
    K --> G
```

## State Machine: Test Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> SetupDB: npm run db:start
    SetupDB --> MigrationsRunning: npm run db:reset
    MigrationsRunning --> MigrationsComplete: Success
    MigrationsRunning --> MigrationsFailed: Error

    MigrationsComplete --> UnitTests: npm run test
    UnitTests --> UnitTestsPass: All pass
    UnitTests --> UnitTestsFail: Some fail

    UnitTestsPass --> E2ETests: npm run e2e
    E2ETests --> E2ETestsPass: All pass
    E2ETests --> E2ETestsFail: Some fail

    E2ETestsPass --> Done
    UnitTestsFail --> FixTests
    E2ETestsFail --> FixTests
    FixTests --> UnitTests

    Done --> [*]
```

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Jest for unit/integration | Industry standard, good TypeScript support via ts-jest |
| Playwright for E2E | Cross-browser, built-in assertions, excellent DX |
| Service-role for test setup | Bypasses RLS for fixture creation |
| Separate .env.test | Isolates test config from dev config |
| FK-order table deletion | Prevents constraint violations during reset |
| Grant statements for roles | Required for Supabase RLS to function properly |

## Success Criteria

- [x] `npm run db:start` starts local Supabase
- [x] `npm run db:reset` applies all migrations
- [x] `npm run test` passes (4 tests)
- [x] `npm run e2e` passes (1 test)
- [x] Test helpers exported with correct signatures
- [x] Documentation updated

## Related Documents

- [Test Infrastructure Plan](../superpowers/plans/2026-07-08-test-infrastructure.md)
- [CLAUDE.md](../../CLAUDE.md)
- [Feature Spec](../../feature-spec.md)
