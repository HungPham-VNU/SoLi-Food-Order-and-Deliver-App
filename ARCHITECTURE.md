# UITFood Monorepo — Structure & Management Guide

## 1. Overview

UITFood is a food delivery platform managed as a **pnpm workspace monorepo** orchestrated by **Turborepo**. It hosts four applications in `apps/`, with backend infrastructure defined in `infra/` and CI/CD fully automated via GitHub Actions.

---

## 2. Repository Layout

```
uitfood/
├── apps/
│   ├── api/          # NestJS REST/WebSocket backend
│   ├── web/          # Vite + React restaurant portal (SPA)
│   ├── admin/        # Vite + React admin panel (SPA)
│   └── mobile/       # Expo (React Native) customer app
├── infra/
│   ├── render/       # Terraform IaC for Render.com services
│   └── grafana/      # Grafana Cloud config
├── docs/             # Observability & Grafana setup guides
├── .github/
│   ├── workflows/    # GitHub Actions CI/CD pipelines
│   └── actions/
│       └── setup-environment/  # Shared composite action
├── turbo.json        # Turborepo task graph
├── pnpm-workspace.yaml
├── package.json      # Root workspace scripts
├── docker-compose.yml         # Production-like local infra (Postgres + Redis)
├── docker-compose.dev.yml
├── CONTEXT.md        # Domain glossary & architectural rules
└── CICD.md           # Complete CI/CD reference
```

---

## 3. Package Manager & Workspace (pnpm)

**Tool:** `pnpm@11.1.2`  
**Config:** `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

The workspace also applies several security overrides to force minimum safe versions of `esbuild`, `postcss`, `ws`, and `@tootallnate/once`.

Root `package.json` defines workspace-wide scripts delegated through Turborepo:

| Script            | What it does                               |
| ----------------- | ------------------------------------------ |
| `pnpm build`      | Build all apps (respects dependency graph) |
| `pnpm dev`        | Start all apps in watch/dev mode           |
| `pnpm dev:api`    | Start API only                             |
| `pnpm dev:web`    | Start web only                             |
| `pnpm dev:mobile` | Start mobile only                          |
| `pnpm dev:admin`  | Start admin only                           |
| `pnpm lint`       | Lint all packages                          |
| `pnpm test`       | Test all packages                          |

---

## 4. Task Orchestration (Turborepo)

**Config:** `turbo.json`

Turborepo provides task caching, affected-package detection, and dependency-ordered execution.

### Task Graph

| Task        | Depends on                         | Caching                                              | Notes                         |
| ----------- | ---------------------------------- | ---------------------------------------------------- | ----------------------------- |
| `build`     | `^build` (upstream packages first) | ✅ `dist/**`, `.next/**`, `.expo/**`, `web-build/**` | Standard DAG build            |
| `test`      | `transit`                          | ✅                                                   |                               |
| `lint`      | `transit`                          | ✅                                                   |                               |
| `typecheck` | `transit`                          | ✅                                                   |                               |
| `test:e2e`  | `build`                            | ❌ `cache: false`                                    | Always re-runs                |
| `dev`       | —                                  | ❌ `cache: false`, `persistent: true`                | Long-lived watch process      |
| `transit`   | `^transit`                         | ✅                                                   | Synthetic task for sequencing |

The `--affected` flag (used in CI) scopes work to only packages changed by the current commit, using full Git history (`fetch-depth: 0`).

### Global Environment Keys

Changes to any of these invalidate the cache for all tasks:

- `NODE_ENV`, `DATABASE_URL`, `REDIS_URL` — core runtime
- Full OpenTelemetry suite (`OTEL_*`, `GRAFANA_CLOUD_*`)
- Sentry (`SENTRY_*`, `EXPO_PUBLIC_SENTRY_*`)
- Vite build-time vars (`VITE_*`)

---

## 5. Applications

### 5.1 `apps/api` — NestJS Backend

**Runtime:** Node.js 22 / NestJS 11  
**Database ORM:** Drizzle ORM → PostgreSQL 18  
**Cache/Queue:** Redis (ioredis)  
**Auth:** `better-auth` + `@thallesp/nestjs-better-auth`  
**Ports:** 3000 (HTTP + WebSocket via Socket.IO)

#### Internal Module Architecture

```
src/
├── module/
│   ├── auth/               # Auth schema & role utilities (Better Auth)
│   ├── ordering/           # Core ordering bounded context
│   │   ├── acl/            # Anti-Corruption Layer snapshots (Restaurant/Menu data)
│   │   ├── cart/           # Transient cart (Redis-backed)
│   │   ├── order/          # Order aggregate, commands, queries
│   │   ├── order-eligibility/
│   │   ├── order-history/
│   │   └── order-lifecycle/
│   ├── restaurant-catalog/ # Restaurant & menu management
│   │   ├── restaurant/
│   │   ├── menu/
│   │   └── search/
│   ├── image/              # Cloudinary image lifecycle module
│   ├── notification/       # FCM push + email notifications with retry
│   ├── payment/            # VNPay integration
│   ├── promotion/          # Discount/coupon codes
│   └── review/             # Customer reviews
├── drizzle/
│   ├── schema.ts           # Unified DB schema
│   ├── db.ts               # DB connection
│   ├── seeds/              # Dev seed scripts
│   └── out/                # Generated migration files
├── observability/          # OpenTelemetry setup
├── telemetry.ts            # Loaded first via --require at startup
├── config/                 # Typed environment config
└── main.ts
```

#### Bounded-context contract

The authoritative ownership and dependency rules are documented in [apps/api/docs/BOUNDED_CONTEXTS.md](apps/api/docs/BOUNDED_CONTEXTS.md) and enforced by the API architecture test. Nutrition and dietary tags belong to Restaurant Catalog; AI, Redis, geo, and database code are infrastructure.

#### Key Architectural Rules (from `CONTEXT.md`)

1. **ACL Snapshots for core domains** — Ordering and Notification contexts mirror Restaurant/Menu data locally to avoid cross-context coupling.
2. **Public API Port for support contexts** — Payment, IAM, and Image use interfaces/symbols for real-time communication, minimising development overhead.
3. **Price snapshotting at checkout** — Order records snapshot all prices at placement time to prevent price drift.
4. **Silent price increase prevention** — If ACL snapshot price > cart price at checkout, reject with a conflict error.
5. **Image ownership** — Every image stores `ownerId` + `ownerType`; deletion requires ownership verification via `@Session()`.
6. **Notification retry** — Failed FCM/SMTP notifications trigger a background self-healing retry task.

#### Database Scripts

```bash
pnpm --filter api db:generate   # Generate migration SQL
pnpm --filter api db:migrate    # Apply migrations
pnpm --filter api db:push       # Push schema directly (used in CI)
pnpm --filter api db:seed       # Seed basic data
pnpm --filter api db:seed:rich  # Seed rich catalog data
pnpm --filter api db:studio     # Drizzle Studio UI
```

#### Testing

- **Unit tests:** Jest with `ts-jest`, files matching `*.spec.ts` under `src/`
- **E2E tests:** Separate Jest config at `test/jest-e2e.json`, uses Supertest against a real Postgres/Redis
- **Production start:** `node --require ./dist/telemetry dist/main` (telemetry bootstraps before the app)

---

### 5.2 `apps/web` — Restaurant Portal (SPA)

**Stack:** Vite 7 + React 19 + TypeScript 6 + Tailwind CSS v4  
**Routing:** React Router v7  
**State/Data:** TanStack Query v5 + Zustand  
**UI:** shadcn/ui (Radix UI + CVA + tw-merge)  
**Auth:** `better-auth`  
**Analytics:** Grafana Faro (RUM + tracing) + PostHog  
**Served by:** nginx (in production Docker image)

```
src/
├── app/          # Route-level components / pages
├── components/   # Shared UI components
├── features/     # Feature modules (auth, dashboard, menu, orders,
│                 #   restaurant, delivery-zones, image, settings)
├── hooks/        # Custom React hooks
├── lib/          # API client, utilities
└── main.tsx
```

> **Note:** `VITE_*` environment variables are embedded at Docker build time. Changing `VITE_API_BASE_URL` requires rebuilding and republishing the image.

---

### 5.3 `apps/admin` — Admin Panel (SPA)

**Stack:** Same as `web` but without Grafana Faro/PostHog  
**Purpose:** Internal admin operations  
**Served by:** nginx (in production Docker image)

---

### 5.4 `apps/mobile` — Customer App (Expo)

**Stack:** Expo SDK 55 + React Native 0.83 + React 19  
**Navigation:** Expo Router (file-based) + React Navigation  
**Styling:** NativeWind v4 (Tailwind for React Native)  
**State/Data:** TanStack Query v5 + Zustand  
**Auth:** `better-auth` + `@better-auth/expo`  
**Push Notifications:** Firebase Messaging (`@react-native-firebase`)  
**Error Monitoring:** Sentry React Native  
**Maps:** MapLibre React Native

```
src/
├── app/
│   ├── (auth)/         # Login/register screens
│   └── (customer)/
│       ├── (tabs)/     # Bottom tab navigator
│       ├── cart.tsx
│       ├── checkout/
│       ├── orders/
│       ├── product/
│       └── restaurant/
├── features/           # Feature modules (auth, cart, location,
│                       #   notification, orders, promotions, restaurants, review)
├── lib/                # API client (apiFetch), utilities
└── store/              # Zustand stores
```

**Build:** EAS local build targeting Android APK using the `preview` profile:

```bash
eas build --platform android --profile preview --local --non-interactive --output build.apk
```

---

## 6. Local Development

### Infrastructure

```bash
docker compose up -d                       # Postgres 18 + Redis 7
docker compose -f docker-compose.dev.yml up -d  # Dev variant
```

### Running Apps

```bash
pnpm dev           # All apps in parallel (Turborepo)
pnpm dev:api       # NestJS API only
pnpm dev:web       # Vite web SPA only
pnpm dev:admin     # Vite admin SPA only
pnpm dev:mobile    # Expo mobile only
```

### Environment Variables

Copy `.env.example` to `.env` at the repo root. Key variables:

| Variable                     | Purpose                               |
| ---------------------------- | ------------------------------------- |
| `DATABASE_URL`               | PostgreSQL connection string          |
| `REDIS_URL`                  | Redis connection                      |
| `VITE_API_BASE_URL`          | API URL baked into web build          |
| `EXPO_PUBLIC_API_URL`        | API URL in mobile bundle              |
| `OTEL_*` / `GRAFANA_CLOUD_*` | OpenTelemetry export to Grafana Cloud |
| `EXPO_PUBLIC_SENTRY_*`       | Sentry for mobile                     |
| `VITE_GRAFANA_FARO_*`        | Faro RUM for web                      |
| `VITE_POSTHOG_KEY`           | PostHog analytics for web             |

---

## 7. Code Quality

- **Linter:** ESLint (each app has its own `eslint.config.mjs` / `eslint.config.js`)
- **Formatter:** Prettier 3 (root `.prettierrc`, workspace-wide)
- **TypeScript:** Each app has its own `tsconfig.json`; API and web use TS 6, mobile uses TS ~5.9

```bash
pnpm lint                       # Lint all packages via Turborepo
pnpm turbo run typecheck        # Type-check all packages
```

---

## 8. Observability

### API (Server-Side)

- **OpenTelemetry** — Traces, metrics, and logs exported via OTLP to Grafana Cloud
- `telemetry.ts` bootstraps the OTel SDK before the NestJS app starts (`--require ./dist/telemetry`)
- Sampling controlled by `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG`

### Web (Client-Side)

- **Grafana Faro SDK** — Real-User Monitoring (RUM), browser traces, and source map upload via `@grafana/faro-rollup-plugin`

### Mobile

- **Sentry React Native** — Crash reporting and performance tracing

See `docs/observability.md`, `docs/observability-setup.md`, and `docs/grafana-cloud-dashboard.md` for full setup guides.

---

## 9. CI/CD Pipelines

### Shared Setup

All workflows use `.github/actions/setup-environment`, which installs **pnpm 11.1.2 + Node.js 22** and runs `pnpm install --frozen-lockfile`.

### Pipeline Workflows (Entry Points)

| Workflow                  | Trigger                                                | What it does                                                      |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| `pipeline-main.yml`       | Manual `workflow_dispatch`                             | Full path: validate → Docker publish → Render deploy → EAS mobile |
| `pipeline-api.yml`        | Push to `master` touching `apps/api/**`, or manual     | Validate API → publish Docker image → deploy to Render            |
| `pipeline-web.yml`        | Push to `master` touching `apps/web/**`, or manual     | Validate web → publish Docker image → deploy to Render            |
| `pipeline-mobile.yml`     | Push to `master` touching `apps/mobile/**`, or manual  | Validate mobile → EAS Android APK                                 |
| `pipeline-render-iac.yml` | Push to `master` touching `infra/render/**`, or manual | Terraform plan/apply on Render infrastructure                     |

### Reusable Workflows

| Workflow                | Called by           | Purpose                                                                                               |
| ----------------------- | ------------------- | ----------------------------------------------------------------------------------------------------- |
| `ci-validate.yml`       | `pipeline-main.yml` | Full monorepo validation (lint, typecheck, test, build, E2E) with Postgres + Redis service containers |
| `cd-package-docker.yml` | API, Web, Main      | Build + push Docker image to GHCR                                                                     |
| `cd-package-mobile.yml` | Mobile, Main        | EAS local Android build → upload APK artifact                                                         |
| `cd-render-image.yml`   | API, Web, Main      | Call Render deploy hook with new GHCR image tag                                                       |
| `cd-render-iac.yml`     | Render IaC pipeline | Terraform fmt/init/validate/plan/apply                                                                |

### Main Pipeline Job Order

```
validate
  ├── publish-api-docker  (needs: validate)
  ├── publish-web-docker  (needs: validate)
  │     ├── deploy-api-render  (needs: both Docker jobs, only on master)
  │     └── deploy-web-render  (needs: both Docker jobs, only on master)
  └── publish-mobile      (needs: validate)
```

### Docker Images (GHCR)

Images are pushed to:

```
ghcr.io/ndtruongdanh/uitfood-api:<tag>
ghcr.io/ndtruongdanh/uitfood-web:<tag>
```

Tags generated per release:

- `master` — branch tag (mutable)
- `sha-<7-char-sha>` — immutable commit tag, used for Render deploys

**API Dockerfile** — Multi-stage: `turbo prune` → install → `nest build` → runtime image with non-root `nestjs` user, exposes port 3000.  
**Web Dockerfile** — Multi-stage: `turbo prune` → install → `vite build` → **nginx:alpine** serving `dist/`, SPA fallback to `index.html`.

### Turborepo Remote Cache

CI uses `TURBO_TOKEN` + `TURBO_TEAM` for Turborepo remote caching. The `.turbo` directory is also cached locally in GitHub Actions per app using `actions/cache`.

---

## 10. Infrastructure (Terraform on Render)

**Location:** `infra/render/`  
**State:** HCP Terraform (remote state, tagged `uitfood`, `render`, `production`)  
**Provider:** `render-oss/render ~> 1.8`  
**Terraform version:** `>= 1.6.0` (CI installs `1.15.4`)

### Managed Resources

| Resource                                    | Name                   | Default Plan           |
| ------------------------------------------- | ---------------------- | ---------------------- |
| `render_postgres.main`                      | UITFood Postgres       | free                   |
| `render_web_service.api`                    | UITFood API            | image-backed from GHCR |
| `render_web_service.web`                    | UITFood Web            | image-backed from GHCR |
| `render_env_group_link.api_runtime_secrets` | Links env group to API | optional               |

### Secret Boundary

Terraform manages the **infrastructure shape** but not runtime application secrets. Both `render_web_service` resources use:

```hcl
lifecycle {
  ignore_changes = [env_vars, secret_files]
}
```

Runtime secrets (`BETTER_AUTH_SECRET`, `REDIS_HOST`, `CLOUDINARY_*`, `SMTP_*`, `VNPAY_*`, etc.) live in **Render service settings or a Render environment group**, never in Terraform state.

### Image Promotion (App Deploys)

App deploys are **separate from Terraform**. The `cd-render-image.yml` workflow calls Render deploy hooks directly with `imgURL=ghcr.io/...-api:sha-<sha>`. Terraform governs infrastructure shape; deploy hooks govern which image tag is running.

---

## 11. Sources of Truth (Summary)

| Concern                              | Source                                              |
| ------------------------------------ | --------------------------------------------------- |
| Monorepo task graph                  | `turbo.json`                                        |
| Workspace membership                 | `pnpm-workspace.yaml`                               |
| CI/CD orchestration                  | `.github/workflows/*.yml`                           |
| Shared CI setup                      | `.github/actions/setup-environment/action.yml`      |
| API Docker image                     | `apps/api/Dockerfile`                               |
| Web Docker image                     | `apps/web/Dockerfile` + `apps/web/nginx.conf`       |
| Mobile build profile                 | `apps/mobile/eas.json` + root `eas.json`            |
| Render image promotion               | Render deploy hooks via `cd-render-image.yml`       |
| Render infrastructure                | `infra/render/*.tf`                                 |
| Render runtime secrets               | Render service settings / env group (not Terraform) |
| Terraform state                      | HCP Terraform workspace                             |
| Domain language & architecture rules | `CONTEXT.md`                                        |
| Full CI/CD reference                 | `CICD.md`                                           |
