# 0002. Edge gateway as the only public ingress

- **Status:** Proposed
- **Date:** 2026-06-23
- **Deciders:** Architecture owner, Gateway owner, Security, Ops
- **Phase:** 1 (foundational for all later phases)

## Context

Today Web, Admin, and Mobile clients call one base URL that maps directly to the
monolith. To extract services without changing clients, route ownership must be
able to move from the monolith to a service while the public URL and contract
stay identical. Internal services must not be reachable from the internet, and
the public surface must keep its CORS, cookie, Better Auth, VNPay, and WebSocket
behaviour exactly.

## Decision

We will introduce a single **edge API gateway** as the only internet-facing
component, with these properties:

1. **Stable public origin.** The gateway preserves `/api/**`, Better Auth
   callback paths, VNPay return/IPN paths, cookies, request body limits, and
   WebSocket upgrade paths. The public contract is documented by the merged
   OpenAPI document the gateway owns.
2. **Proxy-first rollout.** In Phase 1 the gateway proxies 100% of traffic to the
   monolith. Each later phase moves one route group from "proxy to monolith" to
   "translate to the owning service" — never split a write route group by
   percentage.
3. **Protocol translation at the edge.** The gateway translates inbound HTTP to
   internal NestJS TCP request-response messages (ADR 0004). Clients never speak
   TCP or AMQP and never hold a service-specific internal URL.
4. **Security boundary.** The gateway strips any externally-supplied internal
   auth headers/tokens, propagates `x-request-id` and W3C trace context, sets
   total request timeouts, and performs the session→internal-JWT handoff (future
   auth ADR). Gateway authentication is not a substitute for per-service
   authorization.
5. **Health & rollback.** Gateway route configuration and image are independently
   rollback-able; a rehearsed rollback restores the previous route map.

## Consequences

### Positive

- Clients are decoupled from the physical service topology; extractions are
  invisible to Web/Admin/Mobile.
- One enforcement point for CORS, request IDs, auth handoff, timeouts, and the
  public OpenAPI document.
- Internal services stay on private networking.

### Negative / costs

- A new always-on, latency-sensitive hop and a new single point of failure that
  must be sized, observed, and made highly available.
- The gateway must faithfully reproduce subtle behaviours (multiple `Set-Cookie`
  headers for Better Auth, raw VNPay query strings, long-lived WebSocket frames).

### Risks & mitigations

- **Auth/cookie fidelity** → the gateway↔Identity adapter must carry filtered
  method, URL, headers, cookies, raw body, status, redirects, and multiple
  `Set-Cookie` responses; rehearse each client before cutover.
- **WebSocket handling** → proxy the Socket.IO upgrade as a client connection to
  the owning service; do not tunnel long-lived frames through request-response
  RPC.
- **Added latency** → set per-hop and end-to-end timeout budgets; measure p95
  against the monolith baseline (≤10% regression gate).

## Alternatives considered

- **Clients call services directly** — rejected: breaks the stable public URL,
  leaks topology, and pushes auth/CORS into every client.
- **Library-side routing in each client** — rejected: every topology change
  becomes a coordinated multi-client release.

## References

- `apps/api/docs/MICROSERVICES_MIGRATION_PLAN.md` §4.1, §4.2, Phase 1
- `apps/api/src/main.ts` (current public bootstrap, CORS, OpenAPI merge)
- ADR 0001 (strategy), ADR 0004 (sync vs async)
