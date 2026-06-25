# Phase 4 - Extract Identity and Internal Authentication (Implementation Report)

**Status:** Code boundaries, contracts, gateway route ownership, internal JWT
handoff, switchable monolith adapters, local Compose wiring, and CI workflow are
implemented and verified at the typecheck/component-test level. Remaining owner
actions are live auth data migration, staging session verification, Render
provisioning, rate-limit/audit policy rollout, and production cutover rehearsal.
**Scope:** `apps/services/identity`, `apps/gateway`, `apps/api` Identity/Media
integration, `apps/services/media`, `packages/contracts`, local Compose, CI.
**Date:** 2026-06-25
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md)
Phase 4.

---

## 1. Objective

Extract Better Auth identity authority behind the Gateway without changing the
external `/api/auth/**` URL or cookie contract, and establish signed internal
authentication for service calls.

Phase 4 adds:

- A private `identity` Nest TCP service owning `user`, `session`, `account`, and
  `verification`.
- A Gateway-to-Identity HTTP compatibility adapter for Better Auth routes.
- `identity.session.introspect.v1` for gateway session verification.
- Short-lived HS256 internal JWTs with `iss`, `sub`, `aud`, roles,
  correlation ID, `iat`, `exp`, and `jti`.
- Media-side audience verification for protected RPCs.
- TCP-capable Identity directory adapters for Catalog role promotion and
  Notification contact lookup.

## 2. Resulting Topology

```text
Browser / Admin / Mobile
          |
          v
      Edge Gateway
       |       |
       |       +-- all other routes --> legacy API
       |
       +-- /api/auth/** ---------------> Identity TCP RPC
       |                                  |
       |                                  v
       |                           Identity PostgreSQL
       |
       +-- protected Media routes:
             external session -> Identity introspection
             Gateway signs aud=media internal JWT
             Media verifies JWT before protected RPC work

Catalog / Notifications -- USER_DIRECTORY_PORT --> local or Identity TCP
```

Default flags preserve rollback:

- `IDENTITY_ROUTES_ENABLED=false`: Gateway proxies `/api/auth/**` to the
  monolith.
- `IDENTITY_RPC_ENABLED=false`: API `USER_DIRECTORY_PORT` uses the legacy local
  adapter.
- Enabling both switches auth route ownership and Identity directory calls to
  the extracted service.

## 3. Implementation

### 3.1 Shared Contracts

`packages/contracts` now includes:

- `IDENTITY_RPC_PATTERNS`
  - `identity.auth.http.v1`
  - `identity.session.introspect.v1`
  - `identity.user.contact.get.v1`
  - `identity.user.role.promote-restaurant.v1`
- HTTP proxy request/response contracts preserving method, URL, headers,
  raw/base64 body, status, and multi-value headers such as `Set-Cookie`.
- Identity contact/role event payload schemas:
  - `identity.user-contact.changed.v1`
  - `identity.user-role.changed.v1`
- Internal JWT signing/verifying helpers and claim schema.

### 3.2 Private Identity Service

New app: `apps/services/identity`.

It includes:

- Nest TCP listener and management HTTP `/live` + `/ready`.
- Owned Drizzle schema and migration for Better Auth tables plus
  `outbox_events`.
- Better Auth configuration moved into the service with the existing plugins:
  email/password, bearer, admin roles, phone number, OpenAPI, Expo, and optional
  Google provider.
- Better Auth database hooks that write contact/role change events to the local
  outbox.
- RPC controller wrapping Better Auth and directory operations in stable error
  envelopes.

The service does not expose a public HTTP auth surface; the public contract is
owned by the Gateway.

### 3.3 Gateway Auth Route Ownership

Gateway now has a Phase 4 route flag:

- `IDENTITY_ROUTES_ENABLED=true` handles `/api/auth/**` locally.
- Auth requests are read as raw bytes and sent to Identity over
  `identity.auth.http.v1`.
- Client-supplied internal/trust headers are stripped before forwarding.
- Identity responses are replayed to the client with status, body, redirects,
  and multiple `Set-Cookie` headers preserved.
- `/ready` checks Identity management readiness only when Identity route
  ownership is enabled.

### 3.4 Internal Authentication

Gateway session guards now retain the authenticated session context. For
Gateway-owned protected Media routes:

1. Gateway introspects the external cookie/bearer session through Identity.
2. Gateway signs a short-lived internal JWT with `aud=media`.
3. The Media RPC request includes that token.
4. Media verifies signature, expiry, audience, and trusted issuer before
   executing protected RPCs.

The legacy API's Catalog-to-Media adapter now signs a service-scoped token with
`iss=uitfood-api`, `sub=service:api`, `aud=media`, and role `service`, so
existing Catalog image writes remain authenticated after Media starts enforcing
internal auth.

### 3.5 Identity Directory Adapter Cutover

`apps/api/src/module/auth/identity.module.ts` now binds `USER_DIRECTORY_PORT`
through a config switch:

- local `UserDirectoryAdapter` when `IDENTITY_RPC_ENABLED=false`;
- `IdentityUserDirectoryRpcAdapter` when `IDENTITY_RPC_ENABLED=true`.

This moves the two current cross-context Identity dependencies without changing
Catalog or Notification call sites:

- Catalog owner promotion -> `identity.user.role.promote-restaurant.v1`
- Notification email lookup -> `identity.user.contact.get.v1`

### 3.6 Local Dev and CI

Local Compose now provisions:

- `uitfood_identity` database and `uitfood_identity` credential;
- private Identity service on TCP `4011` and management HTTP `4012`;
- Gateway/API environment variables for Identity RPC and internal JWT secrets.

CI now includes `.github/workflows/pipeline-identity.yml` for typecheck, unit
test, build, and migration validation, plus Docker image publish/deploy hook
wiring.

## 4. Verification Performed

| Check | Result |
| --- | --- |
| Contracts build | Pass |
| Gateway typecheck | Pass |
| API typecheck | Pass |
| Media typecheck | Pass |
| Identity typecheck | Pass |
| Gateway E2E | 3 suites, 15 tests pass |
| Media unit tests | 2 suites, 6 tests pass |
| API Media adapter unit test | 1 suite, 3 tests pass |
| Identity unit test | 1 suite, 2 tests pass |
| API architecture boundary suite | 5 tests pass |
| `docker compose -f docker-compose.dev.yml config --quiet` | Pass |
| Identity build | Pass |

Gateway/Media/API Nest builds were attempted, but this Windows environment
returned `EPERM` while deleting existing `dist` files. The same local artifact
was recorded in Phase 3. Source validation is covered by clean typechecks and
focused tests.

## 5. Exit Criteria Status

| Phase 4 criterion | Status |
| --- | --- |
| Existing users can sign in/out and retain or renew sessions through the same public URL | Code path implemented; live staging session migration/verification pending |
| Services reject expired, unsigned, wrong-audience, and externally injected internal tokens | Internal JWT verifier implemented and enforced by Media protected RPCs; Gateway strips external internal headers |
| Only Identity can read credentials and write auth tables | Identity service owns auth schema/database path; production credential revocation and monolith auth-route cutover pending |

## 6. Owner Actions

- Provision Identity private service and Identity Postgres on Render.
- Add `RENDER_IDENTITY_DEPLOY_HOOK`.
- Configure `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, Google provider secrets,
  and `INTERNAL_AUTH_JWT_SECRET` in scoped service secret groups.
- Backfill `user`, `session`, `account`, and `verification` into the Identity
  database during a controlled maintenance window.
- Set `IDENTITY_ROUTES_ENABLED=true` on Gateway and smoke all Better Auth
  routes, including sign-in, sign-out, callbacks, OTP paths, bearer sessions,
  web/admin cookies, and mobile sessions.
- Set `IDENTITY_RPC_ENABLED=true` on API and verify Catalog role promotion and
  Notification email fallback through TCP.
- Add production rate limits for sign-in, OTP, and session introspection paths.
- Add audit review for admin role changes and verify Identity outbox relay
  publishing before consuming Identity events in later services.
- Rehearse rollback: disable Gateway Identity routes, re-enable monolith auth
  authority only after reverse synchronization is confirmed.

