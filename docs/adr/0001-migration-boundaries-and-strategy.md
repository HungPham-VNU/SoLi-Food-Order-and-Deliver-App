# 0001. Migration boundaries & strangler strategy

- **Status:** Proposed
- **Date:** 2026-06-23
- **Deciders:** Architecture owner, all service owners, Ops, Security, Product
- **Phase:** 0 (governs Phases 1–10)

## Context

`apps/api` is a NestJS modular monolith: one process, one PostgreSQL connection
(`DB_CONNECTION`), in-process CQRS (`EventBus.publish()`), shared transactions
(`UnitOfWorkContext`), shared scheduled jobs, and one deployment unit. It already
enforces bounded contexts in code (`apps/api/docs/BOUNDED_CONTEXTS.md`,
`src/architecture/module-boundaries.spec.ts`): Identity, Restaurant Catalog,
Ordering, Promotions, Payments, Review, Notifications, Image/Media, and Admin
Analytics. Cross-context references are UUIDs, not database foreign keys.

We need to become independently deployable services without a big-bang rewrite,
without breaking the public `/api/**` contract, and without creating a
distributed monolith (many synchronous calls + shared deployment lifecycles).

## Decision

We will migrate using the **Strangler Fig** pattern, extracting one bounded
context at a time behind a stable edge gateway, with the following rules:

1. **Coarse services (~9), not one-per-submodule.** Catalog keeps `menu`,
   `nutrition`, `dietary-tags`, `delivery-zones`, and `search` together;
   Ordering keeps `cart`, `order`, `order-history`, `order-lifecycle`, and the
   ACL snapshots together. Finer splits require a measured scaling/ownership/
   release-cadence justification.
2. **Fixed extraction order** (risk-ascending): platform foundation + gateway →
   Media (pilot) → Identity → Notifications → Catalog → Promotions → Payments →
   Reviews → Ordering → Reporting + monolith retirement.
3. **Backward compatibility is non-negotiable.** `/api/**`, Better Auth callback
   paths, VNPay return/IPN paths, cookies, and WebSocket paths keep their shape
   throughout (enforced by the OpenAPI breaking-change gate, Phase 0).
4. **No shared domain library.** Extracted shared packages (`contracts`,
   `messaging`, `service-bootstrap`, `test-support`) carry infrastructure
   primitives, generated contract types, and test support only — never domain
   entities, Drizzle tables, repositories, or a shared DB client. A shared domain
   library would recreate the monolith at compile time.
5. **Phase gates.** Each phase ends with a sign-off on contract compatibility,
   data reconciliation, SLOs, security, and a rehearsed rollback. Migration
   pauses if two consecutive extractions show no measurable improvement in
   deployment independence, reliability isolation, scaling, or ownership.

## Consequences

### Positive

- The monolith keeps serving traffic throughout; each step is independently
  shippable and reversible.
- Existing bounded-context boundaries and ACL snapshots give a head start.
- Coarse services keep operational overhead proportional to team size.

### Negative / costs

- A long-lived coexistence period: the monolith and extracted services run
  together for multiple releases, doubling some operational surface temporarily.
- Requires durable messaging and idempotency to be built before any stateful
  service moves (see ADR 0004) — front-loaded investment in Phase 2.

### Risks & mitigations

- **Distributed monolith** → enforce call-direction rules, prefer local
  projections/events over synchronous calls, measure dependency depth.
- **Over-splitting** → keep ~9 services; require justification to split further.
- **Scope creep into infra fashions** (k8s, mesh, gRPC, Kafka, event sourcing)
  → explicitly out of scope unless a measured need arises.

## Alternatives considered

- **Big-bang rewrite** — rejected: unacceptable risk to a live ordering/payment
  system and no incremental value delivery.
- **One service per NestJS submodule** — rejected: operational cost and weak
  ownership for a small team; many submodules share a transactional boundary.
- **Stay a modular monolith** — viable and explicitly the fallback: a
  well-enforced distributed modular monolith is preferable to an operationally
  expensive distributed monolith. The phase gates make this an active choice.

## References

- `apps/api/docs/MICROSERVICES_MIGRATION_PLAN.md` §1, §4.2, §7, §14
- `apps/api/docs/BOUNDED_CONTEXTS.md`
- ADR 0002 (gateway), ADR 0003 (database isolation), ADR 0004 (sync vs async)
