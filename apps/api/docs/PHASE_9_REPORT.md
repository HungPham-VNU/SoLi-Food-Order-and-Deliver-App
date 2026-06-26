# Phase 9 - Extract Ordering and harden the checkout saga (Implementation Report)

**Status:** Code-complete and verified at the typecheck/unit/build level. The
Ordering bounded context, its checkout saga over remote TCP, the Catalog
snapshot ACL consumers, the `ordering.*` TCP surface, and the Gateway route
ownership are implemented. Remaining owner actions are the Ordering data +
Redis-cart backfill, Compose/CI/Render infra wiring, the `ORDERING_ROUTES_ENABLED`
cutover, and deletion of the monolith `module/ordering`.
**Scope:** `apps/services/ordering`, `apps/gateway`, `packages/contracts`,
`apps/services/promotion` + `apps/services/payment` (trusted-issuer defaults),
and `apps/api` (read-only source for the move).
**Date:** 2026-06-26
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md)
Phase 9.

---

## 1. Objective

Extract the core transactional boundary — carts, orders, lifecycle, history, and
the Catalog snapshot ACL — into a standalone service, and convert the checkout
flow from in-process port calls into an explicit distributed saga over TCP with
compensation. This is the last business context to leave the monolith; every
dependency (Catalog, Identity, Promotion, Payment, Media, Notification, Review)
was already extracted with stable remote contracts.

## 2. Resulting Topology

```text
Browser / Admin / Mobile / VNPay
          |
          v
      Edge Gateway
       |       |
       |       +-- all unrelated routes ----------> legacy API
       |
       +-- /api/carts/**  (+ /my/checkout) -------> Ordering TCP RPC
       +-- /api/orders/** (history + transitions) -> Ordering TCP RPC
       +-- /api/restaurant|shipper|admin/orders/** -> Ordering TCP RPC
       +-- /api/payments/vnpay/orders/:id/cancel --> Ordering TCP RPC

Ordering service
   |         |          |              |
   |         |          |              +-- Redis (cart + checkout locks/idempotency)
   |         |          +-- Promotion TCP (reserve/confirm/rollback)
   |         +------------- Payment TCP (create-attempt/mark-failed/cancel)
   +-------------------- Ordering PostgreSQL (orders, items, status logs,
                          app_settings, ACL snapshots, outbox/inbox)

RabbitMQ topic exchange
   |                                          ^
   +-- catalog.{restaurant,menu-item,         |
   |       delivery-zone}.changed.v1          +-- ordering.order.placed.v1
   +-- payment.{confirmed,failed}.v1              ordering.order-status.changed.v1
   +-- review.submitted.v1                        (published via the outbox)
        |
        v
   EventBusBridgeConsumer -> in-process CQRS events
        -> ACL snapshot projectors (restaurant/menu-item/delivery-zone)
        -> PaymentConfirmed/Failed lifecycle handlers
        -> OrderingReviewMarker
```

Default flag preserves rollback:

- `ORDERING_ROUTES_ENABLED=false`: Gateway proxies all ordering routes to the
  monolith, which still serves them from the in-place `module/ordering`. Cutover
  flips the flag; the monolith module is deleted only after it is stable.

## 3. Implementation

### 3.1 Private Ordering Service

New app: `apps/services/ordering` (hybrid TCP + management HTTP, ports
**4071 / 4072**). It owns:

- a Nest TCP listener for business RPC and a `/live` + `/ready` management HTTP;
- a dedicated Postgres database (migration `0000_even_nightshade.sql`, 9 tables:
  `orders`, `order_items`, `order_status_logs`, `app_settings`, three
  `ordering_*_snapshots`, `outbox_events`, `inbox_messages` — **no `carts`
  table**, carts live in Redis by design);
- a dedicated Redis instance (`ioredis`) for cart state, the checkout lock, and
  idempotency keys;
- the moved domain: cart, order placement, order-lifecycle state machine +
  timeout cron, order-history, analytics, app-settings, and the
  order-eligibility adapter;
- the Catalog snapshot **ACL** (projectors + repositories + snapshot tables);
- the durable messaging module (outbox relay, inbox dedup, RabbitMQ
  publisher/consumer) and the `EventBusBridgeConsumer`;
- an internal-auth verifier (`verifyOrderingToken`, `requireServiceToken`).

118 `.ts` files were copied from `module/ordering` plus the supporting `shared`,
`messaging`, `lib/geo`, and `integration` trees. Imports were bulk-rewritten
(`@/module/ordering/` → `@/ordering/`; `DB_CONNECTION` → `ORDERING_DATABASE`).
The six Better-Auth REST controllers were removed — their surface is re-created
at the Gateway and translated to TCP. OpenTelemetry `trace` / `domain-metrics`
were replaced with no-op shims to avoid pulling the OTel SDK.

### 3.2 The Distributed Checkout Saga

`PlaceOrderHandler` orchestrates the saga against the **remote** Promotion and
Payment TCP adapters (bound to `PROMOTION_APPLICATION_PORT` /
`PAYMENT_INITIATION_PORT`):

1. **Promotion `reserve`** (`promotion.discount.reserve.v1`) — runs before the DB
   write; degrades to a no-discount result if Promotion is unavailable, so
   checkout is never blocked.
2. **Payment `create-attempt`** (`payment.create-attempt.v1`, VNPay only) —
   returns the payment URL + txn id.
3. **Commit the order `PENDING`** in a single DB transaction, with the
   `ordering.order.placed.v1` event written to the **outbox inside the same
   transaction** (atomic with the order; `UNIQUE(cartId)` idempotency guard).
4. **Confirm** the promotion reservation after the durable commit.

Compensation (all fire-and-forget; a failed compensation never aborts the flow):

- Payment-initiate fails → `promotion.rollback`.
- DB commit fails → `payment.mark-failed` **and** `promotion.rollback`.
- Zero-payable VNPay → `promotion.rollback`.

Every saga RPC is deadline-bounded by `*_RPC_TIMEOUT_MS`.

**Asynchronous resolution leg:** after the customer pays, Payment publishes
`payment.confirmed.v1` / `payment.failed.v1`; the `EventBusBridgeConsumer`
re-emits them as in-process events and the lifecycle handlers transition the
order `pending→paid` (T-02) or `pending→cancelled` (T-03).

### 3.3 Catalog Snapshot ACL (the load-bearing independence guarantee)

Ordering never calls Catalog at runtime. The `EventBusBridgeConsumer` subscribes
to `catalog.restaurant.changed.v1`, `catalog.menu-item.changed.v1`, and
`catalog.delivery-zone.changed.v1`, dedupes through the inbox, and re-emits
in-process events that the idempotent ACL projectors (`ON CONFLICT DO UPDATE`)
write into the local snapshot tables. Checkout validates restaurant/menu/zone
state and prices entirely from these snapshots.

### 3.4 Shared Contracts and TCP Surface

`packages/contracts/src/ordering-rpc.ts` grows `ORDERING_RPC_PATTERNS` from 1 to
**22 versioned patterns**: cart (6), checkout (1), lifecycle transition + order
reads + payment-cancel (4), per-actor history (10), plus the pre-existing
service-to-service `ordering.review-eligibility.get.v1` used by the Review
service. The eight REST lifecycle actions collapse to a single
`ordering.order.transition.v1` pattern; the Gateway maps each action to a target
status and the Ordering handler resolves the actor + role from the verified
token.

Service-side RPC controllers (`OrderingCart/Order/History/RpcController`) verify
the `aud=ordering` token and delegate to `CartService`, the `CommandBus`
(`PlaceOrderCommand` / `TransitionOrderCommand`), `OrderHistoryService`, and
`OrderRepository`.

### 3.5 Gateway Route Ownership

`apps/gateway/src/ordering/` adds `OrderingRoutesModule` (behind
`ORDERING_ROUTES_ENABLED`) with six controllers covering carts + checkout,
single-order reads + lifecycle transitions, the per-actor history lists, and the
mobile VNPay pending-payment cancellation. Reads/mutations are session-guarded;
the Gateway mints an `aud=ordering` JWT carrying the caller's id + roles. CORS +
JSON body parsing are wired into `gateway.factory.ts`, and `api-proxy.factory.ts`
excludes the ordering prefixes (`isOrderingPublicRoute`) from the legacy proxy
when the flag is on — designed to avoid collision with Catalog's
`/api/restaurant/` prefix and Payment's exact-match `/api/payments/**` routes.

### 3.6 Cross-Service Auth Hardening

Ordering signs its saga service-tokens with issuer `uitfood-ordering`. Promotion
and Payment only trusted `uitfood-gateway,uitfood-api`, so every saga RPC would
have been rejected as `wrong_issuer`. `uitfood-ordering` was added to the
trusted-issuer defaults of both services.

## 4. Cutover And Rollback Procedure

### Forward Cutover

1. Provision Ordering Postgres + Redis + the private service (flag off); add the
   Compose/CI/Render infra mirroring the catalog Step-7 work.
2. Run Ordering migrations.
3. Backfill `orders`, `order_items`, `order_status_logs`, `app_settings`, and the
   ACL snapshot tables from the monolith; replay/rebuild the snapshots from the
   broker and compare. Migrate active Redis carts (or accept a cart-cold cutover
   window).
4. Set `PROMOTION_RPC_REQUIRED` / `PAYMENT_RPC_REQUIRED` as desired and verify a
   full checkout (reserve → create-attempt → commit → confirm) and the async
   payment-confirmed/failed transitions against the services.
5. Enable Gateway Ordering routes: `ORDERING_ROUTES_ENABLED=true`.
6. Smoke cart CRUD, checkout (COD + VNPay), lifecycle transitions for restaurant
   / shipper / admin, history for all actors, and the mobile payment cancel.
7. After the flag is stable, **delete** the monolith `module/ordering` and retire
   the now-unused legacy ordering tables.

### Rollback

1. `ORDERING_ROUTES_ENABLED=false` (Gateway resumes proxying to the monolith).
2. The monolith remains authoritative until its module is deleted.

## 5. Verification Performed

| Check | Result |
| --- | --- |
| Contracts typecheck + build | Pass |
| Ordering typecheck | Pass |
| Ordering unit tests | 9 suites, 135 tests pass |
| Ordering migration generation | Pass; `0000_even_nightshade.sql` (9 tables) |
| Gateway typecheck | Pass |
| Workspace typecheck (`turbo run typecheck`) | 15/15 packages pass |
| Workspace tests (`turbo run test`) | 14/14 tasks pass (ordering 135, catalog 69, notification 185, …) |

## 6. Exit Criteria Status

| Phase 9 criterion | Status |
| --- | --- |
| Ordering checkout uses only its local snapshots and succeeds while Catalog is temporarily unavailable | Implemented — checkout reads restaurant/menu/zone + price exclusively from ACL snapshots; no runtime Catalog call |
| Search, menu, restaurant, nutrition, modifier, zone, and dietary-tag contract suites show parity | N/A for Ordering — those are Catalog (Phase 6); Ordering's 135 specs pass against the moved domain |
| Snapshot rebuild from an empty database is documented, tested, and meets recovery target | Bridge + idempotent projectors implemented; an empty-DB rebuild drill remains an owner action |

## 7. Owner Actions

- Add the Ordering Compose/CI/Render infra (Postgres + Redis + private service),
  mirroring the catalog Step-7 wiring; add `RENDER_ORDERING_DEPLOY_HOOK`.
- Run the Ordering data + snapshot backfill and the Redis-cart migration during a
  controlled window; rehearse an empty-DB snapshot rebuild.
- Flip `ORDERING_ROUTES_ENABLED`; monitor checkout RPC latency, the
  promotion/payment saga + compensation rates, and `ordering.*` outbox lag.
- After the flag is stable, delete the monolith `module/ordering` and retire the
  legacy ordering tables — this completes the strangler migration of all business
  contexts out of the monolith.
