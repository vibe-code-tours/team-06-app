# Workflow: Kitchen Dashboard Implementation

## Overview

This workflow documents the implementation of the Kitchen Dashboard feature. It establishes the API route handler pattern, adds the order status service, Realtime polling fallback hook, and wires the kitchen UI with proper error handling and reject action.

## Status: ✅ Complete

## Workflow Diagram

```mermaid
flowchart TD
    A[Start: Kitchen Dashboard] --> B[Task 1: API Response Envelope]
    B --> C[Task 2: Order Status Service]
    C --> D[Task 3: API Route Handler]
    D --> E[Task 4: Realtime Polling Hook]
    E --> F[Task 5: Kitchen Dashboard Wiring]
    F --> G[Task 6: Dark Theme & UI Polish]
    G --> H[Verification & Documentation]

    B --> B1[Create ok/err helpers]
    B1 --> B2[Write tests]
    B2 --> B3[Commit]

    C --> C1[Create updateOrderStatus service]
    C1 --> C2[Wrap update_order_status RPC]
    C2 --> C3[Write tests]

    D --> D1[Create POST /api/orders/:orderId/status]
    D1 --> D2[Zod validation]
    D2 --> D3[Auth check]
    D3 --> D4[Write integration tests]

    E --> E1[Create useRealtimeWithPolling hook]
    E1 --> E2[Realtime subscription]
    E2 --> E3[Polling fallback]
    E3 --> E4[Write tests]

    F --> F1[Replace direct Supabase update]
    F1 --> F2[Wire polling hook]
    F2 --> F3[Add reject button]
    F3 --> F4[Add error display]
    F4 --> F5[Add confirmation dialog]

    G --> G1[Dark theme CSS variables]
    G1 --> G2[Brand colors]
    G2 --> G3[Gradient backgrounds]
    G3 --> G4[Animations & glow effects]
    G4 --> G5[Logo integration]
```

## Task Dependencies

```mermaid
graph LR
    T1[Task 1: API Response] --> T2[Task 2: Order Service]
    T2 --> T3[Task 3: Route Handler]
    T1 --> T3
    T3 --> T5[Task 5: Wiring]
    T4[Task 4: Polling Hook] --> T5
    T5 --> T6[Task 6: Theme]

    style T1 fill:#e3f2fd
    style T2 fill:#e3f2fd
    style T3 fill:#e3f2fd
    style T4 fill:#e3f2fd
    style T5 fill:#fff3e0
    style T6 fill:#fce4ec
```

## Architecture Pattern

```mermaid
sequenceDiagram
    participant UI as Kitchen Page
    participant API as Route Handler
    participant SVC as Order Service
    participant DB as Postgres Function

    UI->>API: POST /api/orders/:id/status
    API->>API: Validate with Zod
    API->>API: Check auth (supabase.auth.getUser)
    API->>SVC: updateOrderStatus(client, id, status)
    SVC->>DB: rpc('update_order_status')
    DB-->>SVC: { status } or { error }
    SVC-->>API: { status } | { error }
    API-->>UI: ok(result) or err(code, message)
    UI->>UI: Update order list or show error
```

## Realtime + Polling Pattern

```mermaid
sequenceDiagram
    participant Hook as useRealtimeWithPolling
    participant RT as Supabase Realtime
    participant Poll as setInterval
    participant Page as Kitchen Page

    Hook->>RT: Subscribe to 'orders' changes
    Hook->>Poll: Start polling (15s interval)

    alt Realtime event received
        RT-->>Hook: onChange()
        Hook-->>Page: fetchOrders()
    end

    alt Polling interval elapsed
        Poll-->>Hook: onChange()
        Hook-->>Page: fetchOrders()
    end

    Note over Hook,Poll: Both run simultaneously for redundancy
```

## File Structure

```mermaid
graph TD
    subgraph "New Files"
        A[packages/shared/src/http/apiResponse.ts]
        B[apps/web/lib/services/orderStatusService.ts]
        C[apps/web/app/api/orders/[orderId]/status/route.ts]
        D[apps/web/hooks/useRealtimeWithPolling.ts]
    end

    subgraph "Modified Files"
        E[apps/web/app/(kitchen)/kitchen/page.tsx]
        F[apps/web/app/(auth)/login/page.tsx]
        G[apps/web/app/globals.css]
        H[apps/web/tailwind.config.ts]
    end

    subgraph "Test Files"
        I[tests/http/apiResponse.test.ts]
        J[tests/services/orderStatusService.test.ts]
        K[tests/api/orders-status-route.test.ts]
        L[tests/hooks/useRealtimeWithPolling.test.tsx]
    end

    A --> I
    B --> J
    C --> K
    D --> L

    A --> C
    B --> C
    C --> E
    D --> E

    G --> E
    G --> F
    H --> E
    H --> F
```

## State Machine: Order Status

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> ACCEPTED: Kitchen accepts
    PENDING --> CANCELLED: Kitchen rejects
    ACCEPTED --> PREPARING: Start cooking
    ACCEPTED --> CANCELLED: Kitchen rejects
    PREPARING --> READY: Meal ready
    PREPARING --> CANCELLED: Kitchen rejects
    READY --> COMPLETED: Picked up

    note right of PENDING: CANCELLED reachable from\nany pre-COMPLETED state
```

## Decision Log

| Decision | Rationale |
|----------|-----------|
| ok()/err() envelope | Consistent response shape for all route handlers |
| Service wraps RPC | Single place for update_order_status call, reusable by staff dashboard |
| Polling alongside Realtime | Redundancy for dropped connections, harmless double-fetch |
| onChange excluded from deps | Prevents channel re-subscription on every render |
| Confirmation dialog for reject | Prevent accidental order cancellation |
| Dark theme with gradients | Brand identity, modern aesthetic, reduces eye strain |

## Success Criteria

- [x] Kitchen dashboard routes all status changes through API
- [x] ok()/err() envelope used by route handler
- [x] Reject order action with confirmation dialog
- [x] Polling fallback for Realtime connection drops
- [x] Errors displayed to user (not silently swallowed)
- [x] Tests pass: 4 apiResponse + 2 orderStatus + 3 route + 1 polling = 10 tests
- [x] useRealtimeWithPolling and orderStatusService have correct signatures for reuse
- [x] Dark theme with brand colors applied

## Related Documents

- [Kitchen Dashboard Plan](../superpowers/plans/2026-07-09-kitchen-dashboard.md)
- [Test Infrastructure](plan-1.md)
- [DB Schema Verification](plan-2.md)
- [CLAUDE.md](../../CLAUDE.md)
- [Feature Spec](../../feature-spec.md)
