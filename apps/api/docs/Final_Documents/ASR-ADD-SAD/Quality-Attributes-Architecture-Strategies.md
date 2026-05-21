# Quality Attributes — Architecture Strategies (Course Project)

Context: Software Architecture course project (e.g., Food Delivery system). This document turns quality attributes into actionable architectural tactics, patterns, and implementation ideas.

Target architecture assumption: **Modular monolith** (modular software, not microservices).

- “Service” in this document can be read as **module/component** inside the same deployable when you use a modular monolith.
- Key goal: **strong module boundaries** (separate packages/namespaces, explicit public APIs, minimal coupling) while keeping one deployment unit.
- Scalability/availability tactics often become “**scale the whole app horizontally**” + “isolate failure with bulkheads/queues” rather than “scale one microservice”.

## Modular Monolith Reference Blueprint (practical)
Use this as the “default mapping” for tactics that are often explained in microservices terms.

- **Module boundaries**
  - Organize by bounded context (e.g., Catalog, Ordering, Delivery, Payments integration, Notifications).
  - Each module exposes a **public API** (interfaces/handlers) and hides internals; other modules can’t reach into its persistence models.
  - Enforce boundaries with tooling (examples): ArchUnit (Java), NetArchTest (C#), ESLint boundary rules (TS/JS).
- **Integration styles**
  - **In-process calls** for synchronous domain use cases (module A calls module B’s public API).
  - **Domain events** inside the process for decoupling (Observer / Mediator). Optionally also publish selected events to a broker for async work.
  - **Message broker** (queue/pub-sub) is still valid for: background jobs, retries, integrations, notifications, analytics.
- **Data ownership (common in modular monoliths)**
  - One database is acceptable; keep a **separate schema/table group per module** and don’t allow cross-module writes.
  - For cross-module reads, prefer: read models, APIs, or carefully curated DB views.
- **Deployment topology**
  - Run multiple **application instances** behind a load balancer (stateless app instances).
  - Run **separate worker processes** (same codebase) for queued/background jobs.
- **Resilience rule of thumb**
  - Circuit breakers/timeouts are most valuable at **external dependency boundaries** (payment, maps, SMS/email), not between in-process modules.

## How to Specify a Quality Attribute Requirement (Scenario Template)
Use this template to make requirements measurable/testable (from “quality attribute scenario”):

- **Source of stimulus**: actor that triggers the event (user, admin, external system, attacker, scheduler)
- **Stimulus**: what happens (request spike, node failure, data change, intrusion attempt)
- **Environment**: when it happens (normal ops, peak hour, partial outage, deployment)
- **Artifact**: what is affected (API, database, message broker, mobile app)
- **Response**: what the system does (reject, degrade gracefully, retry, alert, failover)
- **Response measure**: how we verify it (SLO, latency, error rate, RTO/RPO, coverage, MTTR)

## Strategy Levels
- **Low**: baseline practices expected in most systems.
- **Medium**: recommended for a solid, well-designed architecture.
- **High**: advanced/optional techniques typical for large scale, high risk, or strict compliance.

---

# 1) System Qualities

## Supportability
**Explanation**: Ability to diagnose, understand, and fix problems in production using the information the system provides (logs/metrics/traces, runbooks, diagnostics).

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Layered architecture to centralize cross-cutting concerns (logging, error handling).
  - **Design patterns**: Facade for subsystem entry points; Adapter for external services.
  - **Coding practices**: Structured logging with correlation IDs; consistent error codes; avoid swallowing exceptions.
  - **Infra/tooling**: Central log collection (ELK/EFK, Azure Monitor, CloudWatch); basic dashboards.
- **Medium**
  - **Architecture patterns**: Sidecar/agent-based telemetry; API Gateway for consistent request metadata.
  - **Design patterns**: Circuit Breaker + Retry (with backoff) around external calls.
  - **Coding practices**: OpenTelemetry tracing; “debug endpoints” guarded by auth (e.g., `/health`, `/ready`).
  - **Infra/tooling**: SLO dashboards, alerts, on-call playbooks; log retention + search; incident templates.
- **High**
  - **Architecture patterns**: Event-driven audit stream for key workflows (order created, driver assigned).
  - **Design patterns**: Outbox pattern to ensure observable event emission.
  - **Coding practices**: Built-in diagnostic bundles (config snapshot, dependency check); feature flags for safe rollback.
  - **Infra/tooling**: Distributed tracing + exemplars; chaos drills; automated incident correlation.

## Testability
**Explanation**: Ease of specifying test criteria and verifying the system meets them across unit/integration/e2e, including non-functional tests.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Clear module boundaries; separation of concerns.
  - **Design patterns**: Dependency Injection; Repository for persistence abstraction.
  - **Coding practices**: Unit tests for business logic; deterministic code (time/random injected); small pure functions.
  - **Infra/tooling**: CI running unit tests; code coverage reporting.
- **Medium**
  - **Architecture patterns**: Hexagonal (Ports & Adapters) to test core logic without infrastructure.
  - **Design patterns**: Test doubles (Mock/Stub/Fake); Strategy to swap implementations.
  - **Coding practices**: Contract tests for external APIs; integration tests with ephemeral DB; test data builders.
  - **Infra/tooling**: Testcontainers; separate test environments; static analysis + linters.
- **High**
  - **Architecture patterns**: Contract tests for module boundaries and external integrations; blue/green test gates.
  - **Design patterns**: Saga test harness; state machine testing for workflow engines.
  - **Coding practices**: Property-based testing; load/soak tests in pipeline; mutation testing (selectively).
  - **Infra/tooling**: Synthetic monitoring; canary analysis; performance regression budgets.

---

# 2) Runtime Qualities

## Availability
**Explanation**: Percentage of time the system is operational and able to serve requests; affected by faults, infrastructure, load, and deployment strategy.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Stateless deployment where possible; graceful degradation.
  - **Design patterns**: Timeouts + retries with backoff; fallback defaults.
  - **Coding practices**: Idempotent handlers for retries (e.g., payment confirmation); avoid single points of failure.
  - **Infra/tooling**: Health checks; basic redundancy (2 instances); backups.
- **Medium**
  - **Architecture patterns**: Active-active behind load balancer; bulkhead isolation by dependency.
  - **Design patterns**: Circuit Breaker; Queue-based load leveling.
  - **Coding practices**: Readiness probes; dependency timeouts; anti-corruption layer for unstable partners.
  - **Infra/tooling**: Auto-healing (Kubernetes, VM scale sets); multi-AZ database; rolling deployments.
- **High**
  - **Architecture patterns**: Multi-region failover; cell-based architecture for blast-radius control.
  - **Design patterns**: Outbox + Inbox for exactly-once processing semantics (when needed).
  - **Coding practices**: Backward-compatible schema changes; chaos engineering for failure modes.
  - **Infra/tooling**: Global traffic manager; automated failover drills; formal SLOs with error budgets.

## Interoperability
**Explanation**: Ability to integrate and exchange data with other systems reliably (internal/external), enabling reuse and collaboration.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: API-first approach; clear module/public API contracts and external API contracts.
  - **Design patterns**: Adapter for third-party APIs; Mapper for DTO ↔ domain.
  - **Coding practices**: Versioned APIs; consistent serialization (JSON); explicit time zones and encodings.
  - **Infra/tooling**: OpenAPI/Swagger; reverse proxy / ingress routing (optional).
- **Medium**
  - **Architecture patterns**: Event-driven integration (pub/sub) for loose coupling; domain events between modules.
  - **Design patterns**: Anti-Corruption Layer; Schema Registry usage for events.
  - **Coding practices**: Backward compatibility rules; contract tests; idempotency keys.
  - **Infra/tooling**: Ingress/reverse proxy policies (auth, rate limits); message broker (Kafka/RabbitMQ/Service Bus).
- **High**
  - **Architecture patterns**: BFF (Backend-for-Frontend) for mobile/web; integration hub for partners.
  - **Design patterns**: Saga for long-running cross-system workflows.
  - **Coding practices**: Formal canonical data model; event versioning with upcasters.
  - **Infra/tooling**: Developer portal; partner sandbox; automated compatibility validation.

## Manageability
**Explanation**: Ability for operators to run, monitor, configure, tune, and troubleshoot the system efficiently.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Centralized configuration and logging.
  - **Design patterns**: Options/Configuration objects; Command pattern for admin tasks.
  - **Coding practices**: Config via env vars; sensible defaults; clear startup validation errors.
  - **Infra/tooling**: Dashboards for CPU/memory; log aggregation; runbooks.
- **Medium**
  - **Architecture patterns**: Operational endpoints; separate “admin/ops” module (logical control-plane) from core business modules.
  - **Design patterns**: Health Check pattern; Circuit Breaker for dependency visibility.
  - **Coding practices**: Metrics with labels (tenant, endpoint); tracing; feature flags.
  - **Infra/tooling**: IaC (Terraform/Bicep); CI/CD with rollbacks; alert routing.
- **High**
  - **Architecture patterns**: Multi-tenant management plane; policy-as-code.
  - **Design patterns**: Scheduler + Worker (job orchestration); autoscaling controllers.
  - **Coding practices**: Runtime config reload (where safe); self-tuning (adaptive concurrency limits).
  - **Infra/tooling**: SRE practices (SLOs, error budgets); automated remediation (runbook automation).

## Performance
**Explanation**: Responsiveness under expected workloads—latency, throughput, and resource efficiency.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Reduce chatty calls; prefer coarse-grained APIs.
  - **Design patterns**: Caching (Cache-Aside); Pooling (connection pools).
  - **Coding practices**: Avoid N+1 queries; pagination; async I/O; measure before optimizing.
  - **Infra/tooling**: Basic Application Performance Monitoring; DB indexes; CDN for static content.
- **Medium**
  - **Architecture patterns**: CQRS where reads dominate (can be within one codebase); async processing for non-critical tasks (notifications).
  - **Design patterns**: Batch; Circuit Breaker to prevent cascading latency.
  - **Coding practices**: Performance budgets; query profiling; payload trimming; compression.
  - **Infra/tooling**: Redis; autoscaling; load tests per release.
- **High**
  - **Architecture patterns**: Event streaming; sharding/partitioning; edge computing for geo-latency.
  - **Design patterns**: Write-behind cache; bloom filters (specialized cases).
  - **Coding practices**: Tail-latency optimization; p95/p99 SLO tracking; lock contention minimization.
  - **Infra/tooling**: Traffic shaping at ingress/load balancer (timeouts, retries, rate limiting); global caching; capacity planning.

## Reliability
**Explanation**: Ability to keep delivering correct system behavior over time; often measured by error rate, MTBF, and defect escape.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Clear boundaries; fail fast on invalid inputs.
  - **Design patterns**: Validation; Guard Clauses.
  - **Coding practices**: Defensive coding; input validation; stable error handling; consistent state transitions.
  - **Infra/tooling**: Monitoring for error rates; backups; basic incident response.
- **Medium**
  - **Architecture patterns**: Queue-based processing for at-least-once delivery; idempotent consumers (works well with a modular monolith + worker).
  - **Design patterns**: Retry with jitter; Circuit Breaker; Dead Letter Queue.
  - **Coding practices**: Idempotency keys; transactional outbox; compensating actions.
  - **Infra/tooling**: Runbooks; automated recovery checks; dependency SLIs.
- **High**
  - **Architecture patterns**: Self-healing workflows; state machine orchestration for critical flows.
  - **Design patterns**: Saga with compensation; Event Sourcing (selective).
  - **Coding practices**: Formal invariants; chaos testing; reliability regression tests.
  - **Infra/tooling**: Multi-region DR with tested RTO/RPO; reliability reviews (pre-mortems).

## Scalability
**Explanation**: Ability to handle increased load without unacceptable performance loss; includes both elastic scaling and growth scaling.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Stateless application instances; horizontal scaling.
  - **Design patterns**: Cache-Aside; Producer–Consumer.
  - **Coding practices**: Avoid shared mutable state; efficient DB queries; resource limits.
  - **Infra/tooling**: Load balancer; autoscaling basics; DB read replicas (if supported).
- **Medium**
  - **Architecture patterns**: Partition by bounded context (Orders, Delivery, Payments) as modules inside a modular monolith.
  - **Design patterns**: Bulkhead; Rate Limiter.
  - **Coding practices**: Async jobs for heavy work; backpressure; per-tenant quotas.
  - **Infra/tooling**: Kubernetes HPA; queue depth autoscaling; CDN.
- **High**
  - **Architecture patterns**: Sharding; cell-based architecture; multi-region active-active.
  - **Design patterns**: Consistent hashing for routing; queue partitioning.
  - **Coding practices**: Load shedding; adaptive throttling; data model evolution for scale.
  - **Infra/tooling**: Global traffic routing; multi-node/zone orchestration (if using Kubernetes); capacity forecasting.

## Security
**Explanation**: Protection against unintended or malicious actions; covers confidentiality, integrity, availability, and auditability.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Trust boundaries; least privilege.
  - **Design patterns**: Authorization via policy checks; Secure Defaults.
  - **Coding practices**: Input validation; parameterized queries; secrets not in code; secure password storage.
  - **Infra/tooling**: TLS everywhere; basic IAM; dependency scanning.
- **Medium**
  - **Architecture patterns**: Reverse proxy / ingress enforcing auth/rate limits; “defense-in-depth” between modules (don’t assume module boundaries are security boundaries).
  - **Design patterns**: OAuth2/OIDC; Token validation middleware; CSRF protection.
  - **Coding practices**: Threat modeling; security reviews; audit logs for sensitive actions.
  - **Infra/tooling**: WAF; secrets manager (Vault/Key Vault); SAST/DAST in CI; container image scanning.
- **High**
  - **Architecture patterns**: Isolated PCI/PII zones (network + data access controls); dedicated secure execution environment for sensitive workloads.
  - **Design patterns**: Attribute-based access control (ABAC); envelope encryption.
  - **Coding practices**: Formal security testing; secure SDLC; privacy by design; tamper-evident logs.
  - **Infra/tooling**: SIEM integration; continuous posture management; runtime protection (RASP); key rotation automation.

---

# 3) Design Qualities

## Conceptual Integrity
**Explanation**: Consistency and cohesion of the overall design—shared vocabulary, consistent boundaries, uniform conventions, and a clear architectural vision.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Layered architecture with clear responsibilities.
  - **Design patterns**: Facade to present a consistent subsystem API.
  - **Coding practices**: Consistent naming; coding standards; shared domain language.
  - **Infra/tooling**: Architecture decision records (ADRs); style guides.
- **Medium**
  - **Architecture patterns**: Domain-driven design (bounded contexts); hexagonal architecture.
  - **Design patterns**: Anti-Corruption Layer between contexts.
  - **Coding practices**: Enforced module boundaries; shared libraries only for truly shared concerns.
  - **Infra/tooling**: Lint rules for layering; dependency graph checks (e.g., ArchUnit, dep-cruiser).
- **High**
  - **Architecture patterns**: Architecture governance with “fitness functions” (continuous checks).
  - **Design patterns**: Plugin architecture for extensibility without core pollution.
  - **Coding practices**: Automated architecture tests; explicit public APIs; semantic versioning.
  - **Infra/tooling**: Docs-as-code; automated ADR checks; architecture review automation.

## Flexibility
**Explanation**: Ability to adapt to new requirements, environments, and policies with minimal rework (configurability and change tolerance).

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Configuration-driven behavior; separation of business rules.
  - **Design patterns**: Strategy; Factory.
  - **Coding practices**: Feature flags; avoid hard-coded assumptions; SOLID principles.
  - **Infra/tooling**: Config management; environment-specific deployment variables.
- **Medium**
  - **Architecture patterns**: Plugin/extension points; module boundaries aligned to change rates.
  - **Design patterns**: Observer (events); Adapter for external changes.
  - **Coding practices**: Backward-compatible API changes; schema migration discipline.
  - **Infra/tooling**: Progressive delivery (canary); configuration validation.
- **High**
  - **Architecture patterns**: Rule engine / workflow engine for policy-heavy domains.
  - **Design patterns**: Interpreter (selective); state machine.
  - **Coding practices**: Multi-variant deployments; A/B testing; runtime policy evaluation.
  - **Infra/tooling**: Feature management platforms; dynamic routing; experimentation analytics.

## Maintainability
**Explanation**: Ease of modifying the system—adding features, fixing defects, improving quality—without causing excessive ripple effects.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Single responsibility per module; layered organization.
  - **Design patterns**: DI; Repository.
  - **Coding practices**: Clean code, small functions, meaningful names; consistent error handling.
  - **Infra/tooling**: Linters/formatters; code review.
- **Medium**
  - **Architecture patterns**: Hexagonal architecture; bounded contexts.
  - **Design patterns**: Mediator (CQRS handlers); Template Method for shared flows.
  - **Coding practices**: Refactoring discipline; high-value tests; deprecation policies.
  - **Infra/tooling**: CI quality gates; static analysis; tech debt tracking.
- **High**
  - **Architecture patterns**: Modular monolith with clear packages; “strangler fig” for legacy evolution.
  - **Design patterns**: Event-driven refactoring; anti-corruption layer for migrations.
  - **Coding practices**: Architectural fitness functions; automated dependency constraints.
  - **Infra/tooling**: Automated code ownership; change failure rate tracking; DORA metrics.

## Reusability
**Explanation**: Ability for components/modules to be reused across contexts with minimal duplication and coupling.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Shared libraries for cross-cutting concerns only (logging, auth helpers).
  - **Design patterns**: Utility/Helper patterns (carefully scoped); Adapter.
  - **Coding practices**: Generalize only after 2–3 proven use cases; stable interfaces.
  - **Infra/tooling**: Package management (npm/nuget/maven); semantic versioning.
- **Medium**
  - **Architecture patterns**: Shared modules (e.g., identity, notifications) with strict ownership and stable APIs.
  - **Design patterns**: Facade for shared module APIs.
  - **Coding practices**: Contract-first design; documentation; backwards compatibility.
  - **Infra/tooling**: Internal developer portal; artifact repositories.
- **High**
  - **Architecture patterns**: Product-line architecture; plugin ecosystems.
  - **Design patterns**: Extension objects; ports/adapters to allow reuse across runtimes.
  - **Coding practices**: Stability guarantees; versioned contracts; migration tooling.
  - **Infra/tooling**: Automated dependency updates; compatibility test matrices.

---

# 4) User Qualities

## Usability
**Explanation**: Convenience and effectiveness for end users; includes learnability, efficiency, accessibility, and localization.

**Strategies & implementation ideas**
- **Low**
  - **Architecture patterns**: Simple UI navigation; consistent interaction patterns.
  - **Design patterns**: MVC/MVVM to separate UI from logic.
  - **Coding practices**: Form validation; helpful error messages; responsive layouts.
  - **Infra/tooling**: Basic analytics; accessibility checks.
- **Medium**
  - **Architecture patterns**: BFF pattern to tailor APIs for mobile/web; offline-first where needed.
  - **Design patterns**: Presenter/ViewModel; state management pattern.
  - **Coding practices**: UX consistency guidelines; i18n/l10n support; performance-aware UI.
  - **Infra/tooling**: A/B testing; user journey analytics; crash reporting.
- **High**
  - **Architecture patterns**: Personalization module/capability; real-time updates via WebSockets.
  - **Design patterns**: Recommendation strategies; observer streams.
  - **Coding practices**: Accessibility-first (WCAG); feature flags for UX experiments; predictive prefetch.
  - **Infra/tooling**: Session replay (careful with privacy); automated UX regression; experimentation platform.

---

# Suggested QA Coverage for a Food Delivery System (Optional Checklist)
If you want to make your architecture document measurable, define 1–3 scenarios per attribute. Examples:

- **Availability**: “During peak hour, if one application instance fails, the API remains available with error rate < 1% and recovery < 60 seconds.”
- **Performance**: “Search restaurants p95 < 300ms under 2k RPS; order placement p95 < 500ms.”
- **Security**: “All PII encrypted at rest; admin actions fully audited; OWASP Top 10 mitigations verified.”

(You can remove this section if your instructor wants only tactics and not example requirements.)
