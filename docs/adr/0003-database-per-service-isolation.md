# 0003. Database-per-service isolation

- **Status:** Proposed
- **Date:** 2026-06-23
- **Deciders:** Architecture owner, all service owners, Data/DBA, Security
- **Phase:** 0 decision; enforced from Phase 3 onward

## Context

All modules currently receive the same `DB_CONNECTION`, migrations come from one
schema barrel (`src/drizzle/schema.ts`), and Admin Analytics deliberately joins
Catalog and Ordering tables. Review submission threads one PostgreSQL
transaction across Review, Ordering, and Catalog via `UnitOfWorkContext`. None of
this survives a database split. Cross-context references are already UUIDs (not
FKs), which lowers extraction risk.

## Decision

Each service owns its data exclusively. Specifically:

1. **One logical database + one credential per service** from its first
   extraction. A service must not connect to, query, or share credentials with
   another service's database. Databases may initially share a managed
   PostgreSQL cluster for cost, but never cross-query.
2. **No distributed ACID / 2PC.** Cross-service consistency is eventual, achieved
   via the transactional outbox/inbox pattern (ADR 0004). The `UnitOfWorkContext`
   cross-context transaction is removed (Phase 2) before Review is extracted.
3. **No shared schema barrel at runtime.** Each service owns its Drizzle schema,
   migrations directory, and seeds. The unified barrel is reserved for the
   shrinking legacy monolith and is removed from runtime use at Phase 10.
4. **Reads via projections, not foreign queries.** Where a service needs another
   context's data (e.g. Ordering needs Catalog prices), it keeps a local
   projection/snapshot fed by events (the existing ACL snapshots are the model).
   Admin Analytics becomes an event-fed Reporting service, never a cross-service
   reader.
5. **Least-privilege at the database.** Each runtime credential can access only
   its own service database. Legacy write privileges are revoked after each
   extraction's rollback window.
6. **Architecture tests enforce it.** No service imports another service's
   schema, repository, or migrations; shared packages contain no domain
   persistence.

## Consequences

### Positive

- Services evolve their schemas independently; no informal "shared database API".
- Clear ownership and blast-radius isolation; data-extraction risk is bounded by
  the UUID-based references already in place.

### Negative / costs

- Loss of cross-table joins and single-transaction atomicity across contexts;
  some workflows become sagas with compensation and reconciliation.
- Duplicate/projected data (snapshots) must be kept fresh and reconciled.

### Risks & mitigations

- **Shared DB remains an informal API** → separate credentials/databases, deny
  cross-database access, architecture tests in CI.
- **Lost atomicity (Review/Ordering/Catalog)** → outbox + idempotent consumers;
  the `reviews.order_id` UNIQUE constraint is the final duplicate guard.
- **Stale projections** → projection-lag SLOs, replayable events, periodic
  source reconciliation.

## Alternatives considered

- **Shared database, separate services** — rejected: services cannot evolve
  independently; it reproduces coupling while paying microservice overhead.
- **Distributed transactions / 2PC across service databases** — rejected:
  operationally fragile, poor availability, not supported by the chosen stack.

## References

- `apps/api/docs/MICROSERVICES_MIGRATION_PLAN.md` §2.2, §2.3, §4.1, §5.5
- `apps/api/src/shared/ports/unit-of-work-context.ts`
- `apps/api/src/module/ordering/acl/*` (snapshot model)
- ADR 0001 (strategy), ADR 0004 (sync vs async)
