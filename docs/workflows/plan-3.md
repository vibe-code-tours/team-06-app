# Workflow: Kitchen Dashboard Implementation

## Overview

This workflow documents the implementation of the Kitchen Dashboard feature per plan `2026-07-09-kitchen-dashboard.md`. It establishes the API route handler pattern, adds the order status service, Realtime polling fallback hook, and wires the kitchen UI with proper error handling and reject action. Additional UI/theme work was done after the original plan.

## Status: ✅ Complete

## Original Plan Tasks (2026-07-09-kitchen-dashboard.md)

| Task | Description | Status |
|------|-------------|--------|
| Task 1 | Shared API response envelope (ok/err) | ✅ Done |
| Task 2 | Order status service function | ✅ Done |
| Task 3 | API route handler for order status updates | ✅ Done |
| Task 4 | Realtime + polling fallback hook | ✅ Done |
| Task 5 | Wire kitchen dashboard to API route | ✅ Done |

## Additional Work (Post-Plan)

| Task | Description | Status |
|------|-------------|--------|
| Task 6 | Dark theme with brand colors | ✅ Done |
| Task 7 | Login page theming & logo | ✅ Done |
| Task 8 | Reject order confirmation dialog | ✅ Done |
| Task 9 | Workflow documentation | ✅ Done |

## Workflow Diagram

```mermaid
flowchart TD
    A[Start: Kitchen Dashboard] --> B[Task 1: API Response Envelope]
    B --> C[Task 2: Order Status Service]
    C --> D[Task 3: API Route Handler]
    D --> E[Task 4: Realtime Polling Hook]
    E --> F[Task 5: Kitchen Dashboard Wiring]
    F --> G[Post-Plan: UI Polish]

    G --> G1[Task 6: Dark Theme]
    G --> G2[Task 7: Login Theme & Logo]
    G --> G3[Task 8: Confirmation Dialog]
    G --> G4[Task 9: Documentation]

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

    G1 --> H[Verification & Documentation]
    G2 --> H
    G3 --> H
    G4 --> H
```

## Task Dependencies

```mermaid
graph LR
    subgraph "Original Plan (2026-07-09-kitchen-dashboard.md)"
        T1[Task 1: API Response] --> T2[Task 2: Order Service]
        T2 --> T3[Task 3: Route Handler]
        T1 --> T3
        T3 --> T5[Task 5: Wiring]
        T4[Task 4: Polling Hook] --> T5
    end

    subgraph "Post-Plan Work"
        T5 --> T6[Task 6: Dark Theme]
        T5 --> T7[Task 7: Login Theme]
        T5 --> T8[Task 8: Confirm Dialog]
        T5 --> T9[Task 9: Documentation]
    end

    style T1 fill:#e3f2fd
    style T2 fill:#e3f2fd
    style T3 fill:#e3f2fd
    style T4 fill:#e3f2fd
    style T5 fill:#fff3e0
    style T6 fill:#fce4ec
    style T7 fill:#fce4ec
    style T8 fill:#fce4ec
    style T9 fill:#e8f5e9
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
| Brand colors #05234F / #FE740F | Restaurant brand identity |
| Glassmorphism cards | Modern UI aesthetic, depth perception |
| PostCSS config for Tailwind | Required for Tailwind CSS compilation |
| tailwindcss-animate plugin | Required for animations in Tailwind |

## Success Criteria

### Original Plan (2026-07-09-kitchen-dashboard.md)
- [x] Kitchen dashboard routes all status changes through API
- [x] ok()/err() envelope used by route handler
- [x] Reject order action (CANCELLED status)
- [x] Polling fallback for Realtime connection drops
- [x] Errors displayed to user (not silently swallowed)
- [x] Tests pass: 4 apiResponse + 2 orderStatus + 3 route + 1 polling = 10 tests
- [x] useRealtimeWithPolling and orderStatusService have correct signatures for reuse

### Additional Work (Post-Plan)
- [x] Dark theme with brand colors (#05234F, #FE740F)
- [x] Gradient backgrounds and glassmorphism cards
- [x] Animations (slide-up, pulse-glow)
- [x] Logo integration on login page
- [x] Confirmation dialog for reject action
- [x] Workflow documentation created

## Related Documents

- [Kitchen Dashboard Plan](../superpowers/plans/2026-07-09-kitchen-dashboard.md)
- [Test Infrastructure](plan-1.md)
- [DB Schema Verification](plan-2.md)
- [CLAUDE.md](../../CLAUDE.md)
- [Feature Spec](../../feature-spec.md)
