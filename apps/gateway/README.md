# Edge API Gateway (`apps/gateway`)

The gateway is the single public backend ingress. It serves management endpoints
locally, translates public HTTP routes to private Nest TCP services, and proxies
Notification Socket.IO upgrades to the notification service.

## What it does today

```
Client (Web / Admin / Mobile)
        │  http(s)  +  ws (Socket.IO)
        ▼
┌─────────────────────────────┐
│  apps/gateway  (:8080)      │
│  • /live, /ready  (local)   │
│  • HTTP routes  ───────────►  private TCP services
└─────────────────────────────┘
```

- **Route adapters** translate public HTTP endpoints to private TCP services.
- **Socket.IO proxying** is retained for notification WebSocket upgrades.
- **Edge hardening:** strips client-supplied internal/trust headers
  (`x-internal-jwt`, `x-test-user-id`, …) and stamps/forwards `x-request-id`.
- **Readiness aggregation** checks every enabled backend service.
- Unmatched HTTP routes return 404; there is no catch-all backend fallback.

## Run locally

```bash
pnpm dev:gateway
```

For the full local stack, use `docker compose -f docker-compose.dev.yml up --build`.
Point clients at the gateway origin (`http://localhost:8080`).

## Configuration

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Gateway listen port |
| `GATEWAY_PROXY_TIMEOUT_MS` | `30000` | Socket.IO proxy timeout |
| `NOTIFICATION_SOCKET_TARGET` | `http://localhost:4022` | Notification WebSocket target |
| `*_TCP_HOST` / `*_TCP_PORT` | service-specific | Private TCP service targets |
| `*_MANAGEMENT_URL` | service-specific | Readiness target per service |
| `*_ROUTES_ENABLED` | `true` | Route ownership flags |
| `NODE_ENV` | `development` | Runtime environment |

## Structure

```
src/
├── main.ts                      # bootstrap, wire Socket.IO upgrade
├── app.module.ts                # ConfigModule(validate) + HealthModule
├── config/env.schema.ts         # zod-validated env
├── common/request-context.middleware.ts  # strip trust headers + x-request-id
├── health/                      # /live, /ready (service reachability)
└── proxy/
    ├── api-proxy.factory.ts     # Socket.IO proxy instance
    └── proxy.constants.ts       # management paths, stripped headers
```

## Route Modules

The gateway has dedicated modules for identity, media, notification, catalog,
promotion, payment, review, ordering, and reporting. Route ownership flags
default to enabled.
