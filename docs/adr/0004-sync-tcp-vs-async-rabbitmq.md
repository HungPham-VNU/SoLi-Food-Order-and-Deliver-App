# 0004. Sync (Nest TCP RPC) vs async (RabbitMQ) communication strategy

- **Status:** Proposed
- **Date:** 2026-06-23
- **Deciders:** Architecture owner, all service owners, Ops, Security
- **Phase:** 0 decision; built in Phases 1–2, used by all later phases

## Context

Inter-context communication today is in-process: synchronous via DI ports
(Ordering→Payment/Promotion, Catalog→Identity/Media, Review→Ordering) and
asynchronous via `EventBus.publish()`. `EventBus.publish()` is process-local and
fire-and-forget *after* commit, so a crash between commit and publish silently
loses the event — and a remote service cannot consume it at all. Across a process
boundary we need explicit timeouts, retries, idempotency, and durability that the
in-process model never required.

## Decision

We will use **two distinct transports with a strict rule for which to use**:

1. **Synchronous request-response → NestJS TCP RPC** (`Transport.TCP`,
   `@MessagePattern`, `ClientProxy.send`). Only for request-response where the
   caller needs an immediate answer (e.g. promotion preview/reserve, payment
   attempt create, review eligibility). Rules: versioned pattern names in
   `packages/contracts/rpc`; explicit RxJS `timeout()` at every call site;
   bounded retries with jitter for transient transport failures only; stable
   `RpcException` error envelope; trace/correlation/deadline propagated in
   metadata; TLS in production; connect at startup and expose connection state in
   readiness. No synchronous dependency cycles — allowed directions only:
   Gateway→services, Catalog→Identity/Media, Ordering→Promotion/Payment, and
   temporarily Review→Ordering.
2. **Asynchronous events / fire-and-forget → RabbitMQ** (`Transport.RMQ`,
   `ClientProxy.emit`, `@EventPattern`). Durable topic exchange
   (`uitfood.domain-events`), one durable queue per consumer service (not a
   shared queue), production quorum queues, persistent messages, publisher
   confirms, manual ack, bounded prefetch, per-consumer retry queues, and a
   final DLQ. Versioned routing keys equal to event names
   (`catalog.menu-item.changed.v1`).
3. **At-least-once delivery made safe.** Producers use a **transactional
   outbox** (business write + outbox insert in one local transaction; an outbox
   relay publishes and marks `published_at` only after a publisher confirm).
   Consumers use an **inbox/dedupe table** and idempotent handlers (ack only
   after the local transaction commits). Ordering is independent of global event
   order; handlers use `aggregateVersion`/timestamps/idempotency.
4. **Resilience defaults.** Circuit breakers for optional integrations
   (Notification, Reporting, analytics) so their failure never fails a checkout
   or payment write. Idempotency keys required for checkout, payment-attempt
   creation, promotion reservation, and webhook processing (`orderId` is the
   checkout key).
5. **Versioning.** Event payloads are never changed incompatibly — publish
   `vN+1` and support both during a migration window. Contract compatibility is
   gated in CI (OpenAPI + TCP + AsyncAPI).

## Consequences

### Positive

- Optional/asynchronous work is decoupled and durable; a consumer outage queues
  work instead of failing the producer.
- Synchronous calls have explicit failure semantics (timeout, retry, circuit
  breaker) instead of hidden in-process assumptions.
- Outbox/inbox closes the post-commit event-loss gap that exists today.

### Negative / costs

- Significant new infrastructure: RabbitMQ cluster, outbox/inbox tables and
  relay, contract packages, and per-service TCP listeners — all front-loaded in
  Phases 1–2 before any stateful extraction.
- Eventual consistency changes some observable behaviour (e.g. ratings, reviewed
  markers) and demands idempotent, replay-safe handlers everywhere.

### Risks & mitigations

- **Lost/duplicate events** → transactional outbox, inbox uniqueness, idempotent
  handlers, DLQ, replay tests.
- **RabbitMQ outage / quorum loss** → three-node quorum cluster, local commit +
  outbox so the business write never blocks on the broker, capacity alerts.
- **Sync call storms / cycles** → call-direction rules, prefer events/projections
  over synchronous reads, measure dependency depth.

## Alternatives considered

- **gRPC / Kafka / event sourcing** — rejected for now: no measured need; adds
  operational surface beyond the team's capacity. Revisit per a future ADR if
  metrics justify it.
- **Single transport for everything** — rejected: request-response over a broker
  adds latency and complexity; events over TCP lose durability and fan-out.
- **Keep in-process `EventBus` across services** — impossible: it cannot cross a
  process boundary and loses events on crash.

## References

- `apps/api/docs/MICROSERVICES_MIGRATION_PLAN.md` §4.1, §5.1–§5.5, Phases 1–2
- `apps/api/src/module/ordering/order/commands/place-order.handler.ts`
  (current post-commit `EventBus.publish`, idempotency, promotion reserve/rollback)
- ADR 0003 (database isolation, eventual consistency)
