# Architecture Decision Records (ADRs)

This directory holds the Architecture Decision Records for the SoLi/UITFood
microservices migration. Each ADR captures one significant, hard-to-reverse
decision: its context, the decision, and its consequences.

## Conventions

- One decision per file: `NNNN-short-kebab-title.md` (zero-padded, monotonic).
- Status lifecycle: `Proposed → Accepted → (Superseded by NNNN | Deprecated)`.
- ADRs are immutable once `Accepted`. To change a decision, write a new ADR that
  supersedes the old one and update both `Status` lines.
- Use [`0000-template.md`](./0000-template.md) as the starting point.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](./0001-migration-boundaries-and-strategy.md) | Migration boundaries & strangler strategy | Proposed |
| [0002](./0002-edge-gateway-pattern.md) | Edge gateway as the only public ingress | Proposed |
| [0003](./0003-database-per-service-isolation.md) | Database-per-service isolation | Proposed |
| [0004](./0004-sync-tcp-vs-async-rabbitmq.md) | Sync (Nest TCP RPC) vs async (RabbitMQ) strategy | Proposed |

Further Phase 0 ADRs to add as they are decided: authentication propagation
(internal JWT), saga/orchestration strategy, and deployment topology.

## Governance

ADRs covering a migration phase must be `Accepted` (architecture, service,
operations, security, and product sign-off) before that phase's implementation
begins — see `apps/api/docs/MICROSERVICES_MIGRATION_PLAN.md` §14.
