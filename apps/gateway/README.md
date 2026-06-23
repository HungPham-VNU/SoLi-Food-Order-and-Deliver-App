# Edge API Gateway (`apps/gateway`)

The single internet-facing component of the platform. **Phase 1 scope:** accept
all external traffic and transparently reverse-proxy 100% of it to the monolith
(`apps/api`). No business logic, no database, no auth handoff yet — those arrive
in later phases.

## What it does today

```
Client (Web / Admin / Mobile)
        │  http(s)  +  ws (Socket.IO)
        ▼
┌─────────────────────────────┐
│  apps/gateway  (:8080)      │
│  • /live, /ready  (local)   │
│  • everything else  ──────► │  proxy  ──►  apps/api (:3000)
└─────────────────────────────┘
```

- **Transparent proxy** of all paths except `/live`, `/ready`, `/metrics`. This
  covers all of `/api/**` plus the monolith's root assets (`/docs`,
  `/api-spec.json`, `/firebase-messaging-sw.js`, …).
- **Body is never parsed** (`bodyParser: false`) so Better Auth rawBody, VNPay
  signatures, and multipart uploads pass through byte-for-byte.
- **WebSocket / Socket.IO** upgrades are proxied (`server.on('upgrade', …)`).
- **Edge hardening:** strips client-supplied internal/trust headers
  (`x-internal-jwt`, `x-test-user-id`, …) and stamps/forwards `x-request-id`.
- **CORS stays with the monolith** in Phase 1 (no duplicate `Access-Control-*`).

## Run locally

```bash
cp apps/gateway/.env.example apps/gateway/.env   # adjust if the API isn't on :3000
pnpm --filter api dev        # terminal 1 — monolith on :3000
pnpm dev:gateway             # terminal 2 — gateway on :8080
```

Point clients at the gateway origin (`http://localhost:8080`) instead of the API
directly. The public contract is unchanged.

## Configuration

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Gateway listen port |
| `MONOLITH_UPSTREAM_URL` | `http://localhost:3000` | Upstream monolith base URL |
| `GATEWAY_PROXY_TIMEOUT_MS` | `30000` | End-to-end proxy timeout |
| `NODE_ENV` | `development` | Runtime environment |

## Structure

```
src/
├── main.ts                      # bootstrap: bodyParser off, wire proxy + ws upgrade
├── app.module.ts                # ConfigModule(validate) + HealthModule
├── config/env.schema.ts         # zod-validated env
├── common/request-context.middleware.ts  # strip trust headers + x-request-id
├── health/                      # /live, /ready (upstream reachability)
└── proxy/
    ├── api-proxy.factory.ts     # http-proxy-middleware instance
    └── proxy.constants.ts       # management paths, stripped headers
```

## Not in scope yet (later phases)

Route-level translation to Nest TCP services, internal JWT issuance/session
introspection, gateway-owned CORS, rate limiting, and the merged OpenAPI
document. Today every route still resolves to the monolith.
