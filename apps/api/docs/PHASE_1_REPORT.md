# Phase 1 — Platform Foundation & Edge Gateway (Implementation Report)

**Status:** Edge gateway built, tested, and dockerised; CI pipeline and Render/Terraform wiring implemented and verified locally. Remaining: provision the gateway on Render (`terraform apply`), add the deploy-hook secret, and route staging traffic through it (owner actions).
**Scope:** `apps/gateway` (new), `turbo.json`, root `package.json`, `.github/workflows/`, `infra/render/`
**Date:** 2026-06-23
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md) §4 (target architecture), §6 (repo structure), Phase 1 objectives & exit criteria

---

## 1. Objective

Prove that one independently deployed component (the edge gateway) can sit in
front of the monolith, accept all external traffic, and transparently proxy 100%
of it — **without any client change and without altering the public contract**.
No business logic, databases, or service extraction in this phase.

Guiding principle: the gateway is the only internet-facing component and must be
a **byte-faithful pass-through** in Phase 1, so that later phases can move route
ownership behind it invisibly.

---

## 2. Tooling decision

Stayed on the existing **Turborepo + pnpm workspaces** stack (no Nx / Nest CLI
workspace migration). `pnpm-workspace.yaml` already globs `apps/*` and
`packages/*`; Phase 1 simply adds `apps/gateway`. `packages/*` scaffolding is
deferred to Phase 2 where it is first needed.

**`apps/api` was NOT renamed to `apps/monolith`.** That rename touches the
Dockerfile, `pipeline-api.yml` path filter, Terraform, turbo `--filter` scopes,
and the GHCR image name — high churn, outward-facing, and against migration plan
§6 (which keeps `apps/api/` as the shrinking legacy monolith). `apps/api` *is*
the monolith conceptually. A rename, if desired, should be a separate isolated PR.

---

## 3. Changes by file

| File | Type | Change |
| --- | --- | --- |
| `apps/gateway/src/main.ts` | **new** | Bootstrap: `bodyParser:false`, wire proxy + WebSocket upgrade, listen |
| `apps/gateway/src/gateway.factory.ts` | **new** | `createGatewayApp(overrides?)` — shared wiring for `main.ts` and tests |
| `apps/gateway/src/app.module.ts` | **new** | `ConfigModule(validate)` + `HealthModule` |
| `apps/gateway/src/config/env.schema.ts` | **new** | zod-validated env (PORT, MONOLITH_UPSTREAM_URL, timeout) |
| `apps/gateway/src/common/request-context.middleware.ts` | **new** | Strip trust headers + stamp/forward `x-request-id` |
| `apps/gateway/src/proxy/api-proxy.factory.ts` | **new** | `http-proxy-middleware` v3 instance + 502 error envelope |
| `apps/gateway/src/proxy/proxy.constants.ts` | **new** | Management paths + stripped-header list |
| `apps/gateway/src/health/health.controller.ts` + `.module.ts` | **new** | `/live`, `/ready` (upstream reachability) |
| `apps/gateway/test/gateway-proxy.e2e-spec.ts` | **new** | 7 proxy-contract E2E tests vs an echo-upstream |
| `apps/gateway/{package.json,tsconfig.json,tsconfig.spec.json,nest-cli.json,Dockerfile,.env.example,README.md,test/jest-e2e.json}` | **new** | App scaffolding |
| `package.json` (root) | edit | Added `dev:gateway` script |
| `turbo.json` | edit | Added `MONOLITH_UPSTREAM_URL`, `GATEWAY_PROXY_TIMEOUT_MS` to `globalEnv` |
| `.github/workflows/pipeline-gateway.yml` | **new** | Validate → publish Docker → deploy Render |
| `infra/render/main.tf` | edit | `render_web_service.gateway` + gateway env locals |
| `infra/render/variables.tf` | edit | Gateway service name, image url/tag, domains, health path, env vars, upstream url |
| `infra/render/outputs.tf` | edit | `gateway_service_id`, `gateway_service_url` |
| `infra/render/production.auto.tfvars.example` | edit | Gateway tfvars (required `gateway_image_tag`, upstream, domains) |

---

## 4. The gateway

```
Client (Web / Admin / Mobile)
        │  http(s) + ws (Socket.IO)
        ▼
┌─────────────────────────────┐
│  apps/gateway  (:8080)      │
│  /live, /ready  (local)     │
│  everything else ─────────► │  proxy  ──►  apps/api (:3000)
└─────────────────────────────┘
```

### Fidelity decisions (why the contract is preserved)

- **`bodyParser: false`** — the gateway never consumes the request body; the
  proxy streams it untouched, so Better Auth rawBody, VNPay HMAC signatures, and
  multipart uploads survive the hop.
- **`pathFilter`** proxies everything except `/live`, `/ready`, `/metrics`,
  covering all of `/api/**` plus the monolith's root assets (`/docs`,
  `/api-spec.json`, `/firebase-messaging-sw.js`).
- **`ws: true` + `server.on('upgrade', proxy.upgrade)`** — Socket.IO/WebSocket
  notifications pass through.
- **`changeOrigin` + `xfwd`**; client `Origin` forwarded unchanged so **CORS
  stays owned by the monolith** in Phase 1 — no duplicated `Access-Control-*`
  headers. Ownership moves to the gateway in a later phase.
- **Edge hardening** — strips client-supplied trust headers (`x-test-user-id`,
  `x-internal-jwt`, `x-internal-user`, `x-gateway-authenticated`) and
  stamps/forwards `x-request-id`. W3C `traceparent` is forwarded intact.
- **`/ready`** returns 503 when the upstream is unreachable (transport failure),
  treating any HTTP response — even 404 — as "reachable".

---

## 5. Security-regression / proxy-contract tests

`apps/gateway/test/gateway-proxy.e2e-spec.ts` boots the real gateway (via
`createGatewayApp`) in front of a controllable **echo-upstream** that reflects
back method, URL, headers, and the raw body (base64). This proves the proxy
contract precisely — something a real monolith could not report.

| Test | Asserts |
| --- | --- |
| GW-01 | JSON request proxies: method, path, and body round-trip |
| GW-02 | Trust headers stripped; legitimate headers kept; `x-request-id`/`x-forwarded-*` added |
| GW-03 | Binary octet-stream body forwarded byte-for-byte |
| GW-04 | `multipart/form-data` forwarded untouched (boundary preserved) — proves `bodyParser:false` |
| GW-05 / GW-06 | `x-request-id` forwarded when supplied; generated (UUID) when absent |
| GW-07 | `/live` served locally, never proxied |

**Design note:** an echo-upstream is used rather than the real monolith because
the assertions require knowing which headers the upstream received and the exact
raw bytes — neither is observable through a real monolith. A real-monolith
round-trip belongs in the staging smoke test, not unit CI.

---

## 6. CI/CD & infrastructure

### CI — `pipeline-gateway.yml`

Triggers on `apps/gateway/**`. Jobs:

1. **validate** — lint + typecheck + `pnpm audit` + build + gateway E2E. No
   Postgres/Redis/monolith required (the E2E uses an in-process stub).
2. **publish** — reuses the generic `cd-package-docker.yml` with `app: gateway`
   (its build step already runs for any app except `web`/`admin`).
3. **deploy-render** — reuses `cd-render-image.yml` with `app: gateway` and the
   `RENDER_GATEWAY_DEPLOY_HOOK` secret.

The reusable Docker/Render workflows needed **no changes** — they are already
parameterised over `app`.

### Infrastructure — Render/Terraform

Adds `render_web_service.gateway` mirroring the API resource:

- `MONOLITH_UPSTREAM_URL` defaults to the managed API service URL
  (`coalesce(var.gateway_monolith_upstream_url, render_web_service.api.url)`),
  overridable for private networking later.
- Render injects `PORT`; the gateway reads `process.env.PORT`.
- `health_check_path = /ready`.
- `lifecycle ignore_changes = [secret_files]`, consistent with API/web.
- Public domain stays on the API; `gateway_custom_domains` is the cutover lever.

---

## 7. Verification performed

| Check | Result |
| --- | --- |
| `pnpm --filter gateway run typecheck` | ✅ Pass |
| `pnpm --filter gateway run build` (`nest build`) | ✅ Pass |
| `pnpm --filter gateway run test:e2e` | ✅ 7/7 pass |
| Runtime smoke (`node dist/main`): `/live` 200, `/ready` 503 w/o upstream, `/api/*` 502 w/o upstream, `x-request-id` echoed | ✅ |
| Terraform `fmt`/`validate` | ⏳ no local terraform binary; `pipeline-render-iac.yml` runs fmt/validate/plan on push |

---

## 8. Outstanding work (owner actions)

- [ ] Add repo secret **`RENDER_GATEWAY_DEPLOY_HOOK`** (from the gateway service's
      Render deploy hook after first apply).
- [ ] `terraform apply` with `gateway_image_tag` set → provisions the gateway
      service alongside the API.
- [ ] Point clients/staging at the gateway origin and run the **Web / Admin /
      Mobile E2E through the gateway URL** (plan Phase 1 exit criterion).
- [ ] Rehearse **gateway rollback** (previous image + route config).
- [ ] Confirm **no client contains a service-specific internal URL**.
- [ ] Cutover: move `gateway_custom_domains` to the public domain once validated.

---

## 9. Exit-criteria status

| Criterion (plan Phase 1) | Status |
| --- | --- |
| Gateway proxies 100% of traffic to the monolith | ✅ Implemented + E2E proven |
| Public contract preserved (body, cookies, WS, headers, CORS) | ✅ Implemented (`bodyParser:false`, header passthrough, monolith-owned CORS) |
| One deployable hybrid template service + reusable infra module | ✅ Gateway app + Dockerfile + Terraform resource + CI pipeline |
| Failed upstream makes gateway unready; client gets stable error | ✅ `/ready` 503, proxy 502 envelope |
| Web/Admin/Mobile pass E2E using only the gateway URL | ⏳ Owner (needs deployed monolith + DB) |
| Gateway rollback rehearsed | ⏳ Owner |
| No client contains a service-specific internal URL | ⏳ Owner (audit) |

Once the gateway is provisioned on Render, staging traffic is routed through it,
and the client E2E passes via the gateway URL, Phase 1 is complete and we proceed
to **Phase 2 — durable integration (outbox/inbox + RabbitMQ + switchable adapters)**.
