# UITFood — Technical Solution & Stack Breakdown

This document inventories **every major technology used in the project**, what it
does, **why it was chosen**, and **how it's applied here**. It complements
[ARCHITECTURE.md](./ARCHITECTURE.md) (which covers the *shape* of the system);
this file covers the *tools*.

Versions are the ones actually pinned in the repo's `package.json` / Dockerfiles.

---

## 0. Stack at a glance

| Layer | Technology |
|---|---|
| **Language / runtime** | TypeScript 6, Node.js 22/24 |
| **Backend framework** | NestJS 11 (+ CQRS, Schedule, Swagger) |
| **Monorepo tooling** | pnpm 11 workspaces · Turborepo |
| **Inter-service (sync)** | NestJS Microservices — **TCP RPC** |
| **Inter-service (async)** | **RabbitMQ** (topic exchange) via amqp-connection-manager |
| **Edge** | API Gateway (NestJS + http-proxy-middleware + Express 5) |
| **Database** | PostgreSQL 18 + **pgvector**, **Drizzle ORM** + drizzle-kit |
| **Cache / ephemeral** | **Redis** (ioredis) |
| **Contracts / validation** | **Zod 4** (shared package) · class-validator / class-transformer |
| **Auth** | **Better Auth 1.6** + custom **internal JWT** |
| **AI** | **Ollama** (LLM) + pgvector embeddings |
| **Payments / media / comms** | VNPay · Cloudinary · Nodemailer (SMTP) · Firebase (FCM) · Socket.IO |
| **Frontend** | React 19 · Vite 7 · Tailwind CSS 4 · TanStack Query · React Router 7 |
| **Mobile** | Expo (React Native) |
| **Observability** | OpenTelemetry · Grafana Faro · PostHog · JSON logs |
| **Testing** | Jest 29 + ts-jest · @nestjs/testing · Supertest |
| **Packaging / deploy** | Docker + Compose · multi-stage images · GHCR · Render (Terraform) · GitHub Actions |

---

## 1. Language & runtime

### TypeScript `^6.0.3`
Static typing end-to-end — services, gateway, shared contracts, and frontends.
The **shared contracts package** (`@uitfood/contracts`) exports types generated
from Zod schemas, so a change to an event payload or RPC pattern is a **compile
error** in every service that uses it. This is what makes a distributed codebase
refactor-safe.

### Node.js 22 / 24 (alpine)
Service runtime. Dockerfiles use `node:24-alpine` (small, fast base image).
`reflect-metadata` + `emitDecoratorMetadata` power NestJS's decorator DI.

---

## 2. Backend framework — NestJS 11

Chosen because the original monolith was already NestJS, and its **modular +
dependency-injection** model maps cleanly onto bounded contexts — each module
became a service with minimal rewiring.

| Package | Role in the project |
|---|---|
| `@nestjs/common` / `@nestjs/core` `^11.1.21` | DI container, modules, providers, lifecycle hooks |
| `@nestjs/microservices` | **TCP transport** for synchronous RPC between services + gateway |
| `@nestjs/platform-express` + `express ^5.2.1` | HTTP layer for the gateway & management endpoints |
| `@nestjs/config` `^4.0.4` | Env loading; each service validates env at boot (fail-fast) |
| `@nestjs/cqrs` `^11.0.3` | **Ordering** uses Commands (`PlaceOrderCommand`, `TransitionOrderCommand`) + an in-process EventBus for the checkout/lifecycle flow |
| `@nestjs/schedule` `^6.1.3` | Cron jobs — order-timeout auto-cancel, stale-promotion-reservation cleanup, outbox relay tick |
| `@nestjs/swagger` `^11.4.3` | OpenAPI docs for the gateway's public routes |
| `@nestjs/mapped-types` | DTO composition (`PartialType`, etc.) |
| `rxjs ^7.8.2` | RPC calls are Observables; `firstValueFrom` + `timeout()` bound every remote call |

**Hybrid bootstrap:** each service starts a **TCP microservice** (business RPC) +
a **management HTTP** listener (`/live`, `/ready`) in one process — see any
service's `src/main.ts`.

---

## 3. Inter-service communication

### Synchronous — NestJS Microservices **TCP RPC**
When a caller needs an immediate answer (e.g. checkout → *reserve promotion*),
services talk over Nest's TCP transport: `@MessagePattern(PATTERN)` on the callee,
`ClientProxy.send(PATTERN, payload)` on the caller. Every call is
**timeout-bounded** and maps RPC error envelopes back to HTTP status codes.

### Asynchronous — **RabbitMQ** (`amqp-connection-manager ^4.1.14`, `amqplib ^0.10.5`)
For propagating facts ("order placed", "restaurant changed"). A **topic exchange**
(`uitfood.domain-events`) routes versioned events (`ordering.order.placed.v1`) to
per-consumer **quorum queues**.

> **Why a self-managed `amqp-connection-manager` consumer instead of Nest's
> `Transport.RMQ`?** The platform publishes **raw JSON envelopes** to a topic
> exchange with explicit publisher confirms + manual ack and a dead-letter path —
> more control than Nest's RMQ transport gives. Consumers self-subscribe on
> `onApplicationBootstrap`.

### Edge — API Gateway (`http-proxy-middleware ^3.0.5`)
The single public ingress. It authenticates, mints internal JWTs, translates HTTP
→ TCP patterns, and (during migration) proxies not-yet-cut-over routes to the
legacy monolith. Socket.IO upgrades are proxied to the Notification service.

---

## 4. Data layer

### PostgreSQL 18 + **pgvector** (`pgvector/pgvector:0.8.2-pg18`)
Relational store, **one database per service** (`catalog_db`, `ordering_db`, …).
`pgvector` powers Catalog's **semantic menu search** (HNSW index over 768-dim
embeddings); `pg_trgm` + `unaccent` power keyword search.

### **Drizzle ORM** (`drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.10`)
Type-safe SQL. Chosen over a heavier ORM because it's **thin, SQL-first, and fully
typed** — schemas are TypeScript, and complex analytics queries (CTEs, `FILTER`,
window functions) stay readable. `drizzle-kit` generates + applies migrations;
each service migrates its **own** database on startup (`db:migrate`).
`pg ^8.20.0` is the driver.

### **Redis** (`ioredis ^5.10.1`)
Ephemeral, low-latency state:
- **Ordering** — the shopping cart (`cart:<customerId>`), checkout locks (`SET NX`),
  and idempotency keys (so a retried checkout returns the same order).
- **Notification** — presence / unread-count cache (its own Redis instance).

---

## 5. Contracts & validation

### **Zod 4** (`zod ^4.4.3`) — the shared contract language
`@uitfood/contracts` defines every RPC pattern, request/response schema, event
payload, and the internal-JWT helpers as Zod schemas. Producers validate on
publish; consumers `parse()` on receive; TypeScript types are inferred from the
same schema — **one source of truth** for the wire format across all services.

### class-validator / class-transformer
Validate + transform inbound HTTP DTOs at the gateway (`ValidationPipe`).

---

## 6. Authentication & authorization

### **Better Auth 1.6** (`better-auth`, `@better-auth/drizzle-adapter`, `@better-auth/expo`, `@thallesp/nestjs-better-auth`)
Owns users, sessions, accounts, and roles — extracted into the **Identity**
service. Sessions are cookie-based; the gateway introspects them.

### Custom **internal JWT** (in `@uitfood/contracts`)
A short-lived, **audience-scoped** token minted by the gateway per request
(`aud=catalog`, TTL 60s), signed with a shared secret. Each service verifies
audience + issuer + signature and re-checks roles/ownership — services **never
trust raw headers**. Service-to-service calls use a `service:*` subject token.
This is the security backbone of every hop.

---

## 7. Domain-specific integrations

| Capability | Tech | Where |
|---|---|---|
| **Payments** | VNPay (custom integration + IPN/return callbacks, HMAC signature verify) | Payment service |
| **Image storage** | `cloudinary ^2.10.0` (signed uploads) | Media service |
| **Email** | `nodemailer ^9.0.1` (SMTP; no-op provider when unconfigured) | Notification service |
| **Push** | `firebase-admin ^13.10.0` (FCM) | Notification service |
| **Realtime** | `socket.io ^4.8.3` + `@nestjs/platform-socket.io` (WebSocket inbox delivery) | Notification service |
| **AI** | **Ollama** (LLM `gpt-oss:20b`) for nutrition extraction + AI-parsed search intent; `embeddinggemma` for 768-dim embeddings | Catalog service |

Each provider secret lives **only** in the service that owns that capability
(Cloudinary → Media, VNPay → Payment, FCM/SMTP → Notification).

---

## 8. Reliability & consistency patterns (and the tech behind them)

| Pattern | Implemented with |
|---|---|
| **Transactional Outbox** | Drizzle: the business write + an `outbox_events` row committed in **one transaction**; a scheduled relay publishes with `FOR UPDATE SKIP LOCKED` + publisher confirms |
| **Inbox (idempotent consume)** | `inbox_events` unique `(consumer, eventId)` + `ON CONFLICT DO NOTHING` — replays/reorders converge |
| **Saga + compensation** | NestJS CQRS command handler orchestrates promotion-reserve → payment-create-attempt → commit, with fire-and-forget `rollback` / `mark-failed` on failure |
| **Anti-Corruption Layer** | Ordering keeps event-fed snapshot tables of Catalog data → checkout never calls Catalog at runtime |
| **CQRS read model** | Reporting maintains projection fact tables from events → analytics with no cross-service joins |
| **Strangler Fig cutover** | `*_ROUTES_ENABLED` env flags at the gateway decide service-vs-monolith per route |

---

## 9. Frontend

### Web — `apps/web`
| Tech | Version | Use |
|---|---|---|
| **React** | `19.2.4` | UI |
| **Vite** | `7` | Dev server + build (esbuild/rollup) |
| **TypeScript** | `6` | Typing; `tsc --noEmit` gate before build |
| **Tailwind CSS** | `4` (`@tailwindcss/vite`) | Styling |
| **TanStack Query** | `^5.100` | Server-state / data fetching |
| **React Router** | `7` | Routing |
| **React Hook Form** + **Zod** | `^7.76` / `4` | Forms + validation (Zod shared with backend contracts) |
| **@base-ui/react**, **lucide-react** | — | Headless components + icons |
| **Better Auth** client | `1.6` | Session auth against Identity |
| **Grafana Faro** + **PostHog** | `^2.7` / `^1.37` | RUM tracing + product analytics |

The browser talks **only to the gateway** (`VITE_API_BASE_URL=http://localhost:8080`).

### Mobile — `apps/mobile`
Expo (React Native), Better Auth Expo client, Sentry + PostHog.

---

## 10. Observability

| Concern | Tech |
|---|---|
| **Tracing / metrics** | OpenTelemetry (`@opentelemetry/api ^1.4.1`) → OTLP → Grafana Cloud |
| **Structured logging** | JSON logger with request-id correlation (propagated as `x-request-id` from the gateway) |
| **Frontend RUM** | Grafana Faro (web) |
| **Product analytics** | PostHog (web + mobile) |
| **Health** | Every service exposes `/live` (process up) + `/ready` (DB reachable); the gateway `/ready` aggregates all services |

---

## 11. Build, packaging & deployment toolchain

| Tool | Role |
|---|---|
| **pnpm 11 workspaces** | Monorepo package management; content-addressable store; shared deps across services |
| **Turborepo** | Task orchestration + caching (`turbo run build/typecheck/test`); `turbo prune --scope=<svc>` for lean Docker builds |
| **Docker + Compose** | Local: one command brings up the full fleet; a one-shot `backend-deps` container installs shared deps once, all services reuse the image |
| **Multi-stage Dockerfiles** | Prod images: `turbo prune` → install → build → slim `node:24-alpine` runner (non-root) |
| **GHCR** | Container registry for built images |
| **GitHub Actions** | Per-service pipelines: lint → typecheck → unit test → migrate (against a Postgres service container) → build → publish image → deploy |
| **Terraform (Render)** | IaC: per-service `render_private_service` + `render_postgres`, gateway/web as `render_web_service`, cutover flags as variables |
| **Jest 29 + ts-jest** | Unit tests (`--runInBand`); `@nestjs/testing` for DI test modules; **Supertest** for gateway E2E |
| **ESLint + Prettier** | Lint + format across the workspace |

---

## 12. Per-service technology matrix

| Service | Extra tech beyond the NestJS + Drizzle + RabbitMQ baseline |
|---|---|
| **Identity** | Better Auth (+ drizzle/expo adapters) |
| **Media** | Cloudinary |
| **Notification** | Nodemailer (SMTP), Firebase Admin (FCM), Socket.IO, dedicated Redis |
| **Catalog** | pgvector + Ollama (AI search & nutrition), HNSW/GIN indexes, `@nestjs/schedule` (embedding worker) |
| **Promotion** | pricing engine (pure TS), `@nestjs/schedule` (reservation cleanup) |
| **Payment** | VNPay integration, outbox events, timeout cron |
| **Review** | — (thin service; calls Ordering for review-eligibility) |
| **Ordering** | `@nestjs/cqrs`, ioredis (cart), ACL snapshot projectors, checkout saga |
| **Reporting** | event-fed projection tables (CQRS read model), inbound-only messaging |
| **Gateway** | http-proxy-middleware, Express 5, per-service TCP clients, internal-JWT minting |

---

## 13. Why this combination

- **NestJS + TypeScript + Zod contracts** → a distributed system that still feels
  like one typed codebase; wire-format changes fail at compile time.
- **Drizzle + PostgreSQL-per-service** → strong data ownership without a heavy ORM;
  raw SQL power where analytics needs it.
- **TCP RPC for "need it now" + RabbitMQ for "propagate the fact"** → the right
  coupling for each interaction; failures in async consumers never block requests.
- **Outbox/Inbox + idempotent events** → reliable eventing across separate
  databases (the thing that makes database-per-service safe).
- **pnpm + Turborepo + Docker multi-stage** → one repo, many independently
  buildable/deployable services, with fast cached builds and lean images.
- **Better Auth + gateway-issued internal JWTs** → one identity authority, zero
  trust between services.

The result: nine services that deploy, scale, and fail independently, coordinated
by typed contracts and durable events, behind a single secured gateway.
