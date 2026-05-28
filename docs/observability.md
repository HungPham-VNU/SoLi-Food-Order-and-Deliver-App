# Observability

UITFood uses a production MVP observability setup:

- OpenTelemetry exports API traces, metrics, and logs directly to Grafana Cloud over OTLP HTTP when configured.
- Grafana Faro captures web browser errors, logs, Web Vitals, sessions, route changes, frontend traces, and source-map metadata.
- Sentry captures mobile exceptions with release/environment tags.
- The API emits JSON logs with request IDs, trace IDs, route template, route group, status, duration, and safe context.
- Render health checks use API readiness and web container liveness endpoints.

## Runtime Configuration

API environment variables:

```env
OTEL_SERVICE_NAME=uitfood-api
GRAFANA_CLOUD_OTLP_ENDPOINT=https://otlp-gateway-prod-REGION.grafana.net/otlp
GRAFANA_CLOUD_OTLP_USERNAME_OR_INSTANCE_ID=<instance-id>
GRAFANA_CLOUD_OTLP_TOKEN=<access-policy-token>
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
LOG_LEVEL=info
```

Web build-time variables:

```env
VITE_GRAFANA_FARO_COLLECTOR_URL=https://faro-collector-prod-REGION.grafana.net/collect/<collector-id>
VITE_GRAFANA_FARO_APP_NAME=uitfood-web
VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0
VITE_COMMIT_SHA=sha-<git-sha>
```

Web source-map upload variables and secrets:

```env
GRAFANA_FARO_SOURCEMAP_ENDPOINT=<frontend-observability-source-map-api-url>
GRAFANA_FARO_APP_ID=<frontend-observability-app-id>
GRAFANA_CLOUD_STACK_ID=<grafana-cloud-stack-id>
GRAFANA_FARO_SOURCEMAP_API_KEY=<grafana-cloud-access-policy-token>
```

`GRAFANA_FARO_SOURCEMAP_API_KEY` is passed to Docker as a BuildKit secret during
the deployed web image build. It must not be exposed as a `VITE_` variable.

Mobile build-time variables:

```env
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_SENTRY_ENVIRONMENT=production
EXPO_PUBLIC_SENTRY_RELEASE=sha-<git-sha>
EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

CI variables and secrets:

- `GRAFANA_FARO_SOURCEMAP_API_KEY` as a GitHub secret.
- `GRAFANA_FARO_SOURCEMAP_ENDPOINT`, `GRAFANA_FARO_APP_ID`, `GRAFANA_CLOUD_STACK_ID`, `VITE_GRAFANA_FARO_COLLECTOR_URL`, and `VITE_GRAFANA_FARO_APP_NAME` as GitHub variables.
- `SENTRY_AUTH_TOKEN` as a GitHub secret for mobile.
- `SENTRY_ORG` and `SENTRY_MOBILE_PROJECT` as GitHub variables for mobile.
- `EXPO_PUBLIC_SENTRY_DSN` and mobile sample-rate variables as GitHub variables.

If `VITE_GRAFANA_FARO_COLLECTOR_URL` is empty, Web Faro is disabled. If neither
`OTEL_EXPORTER_OTLP_ENDPOINT` nor `GRAFANA_CLOUD_OTLP_ENDPOINT` is set, API OTLP
export is disabled while JSON logs and request IDs remain active.

## Health Checks

Render should use:

- API: `GET /api/ready`
- Web: `GET /healthz`

API endpoints:

- `GET /api/live` returns process liveness only.
- `GET /api/ready` checks Redis and Postgres.
- `GET /api/health` remains a compatibility alias for readiness.

Every API response includes `x-request-id`. Clients may send `x-request-id`; otherwise the API generates one.

## Logs, Traces, and Redaction

API logs are JSON written to stdout/stderr for Render log collection. Each request log includes:

- `requestId`
- `traceId` and `spanId` when OpenTelemetry is active
- HTTP method, path, route template, route group, status, and duration
- `cfRay` when Render/Cloudflare forwards it
- user ID when already available on the request

The monitored API route groups are `menu-items`, `restaurants`, `search`,
`promotions`, `carts`, `my`, `restaurant`, and `payments`. Metrics and traces
also receive `app.route.group`, `app.route.monitored`, and `http.route`.

The redaction layer removes sensitive headers and common secret fields, including auth cookies, bearer tokens, FCM tokens, payment hashes/signatures, SMTP credentials, Cloudinary secrets, and explicitly labelled IP fields. Do not log request bodies, payment payloads, raw addresses, or provider credentials.

Web Faro sets only the stable user ID, not email/name, and disables client-side
geolocation tracking. PostHog session replay remains disabled by default.

## Dashboards and Alerts

Minimum dashboard panels:

- API request rate, p95 latency, and 5xx rate.
- API readiness failures for Redis and Postgres.
- Payment IPN failures and payment timeout task errors.
- Order timeout task errors.
- Notification delivery failures and WebSocket connection errors.
- Web Faro error count and Web Vitals by release/environment.
- Mobile Sentry issue count by release.

Minimum alerts:

- `/api/ready` failing for 2 consecutive checks.
- API 5xx rate above 2% for 5 minutes.
- p95 API latency above 2 seconds for 10 minutes.
- Payment IPN error spike.
- Notification delivery failure spike.
- New Web Faro error in production on the latest release.
- New mobile Sentry issue in production on the latest release.

## Incident Runbook

1. Open Render service logs and filter by `requestId` if a user report includes it.
2. Search Grafana Cloud Frontend Observability by release, environment, user ID, and request ID for web reports.
3. Search Sentry by release and environment for mobile reports.
4. Check `/api/ready` to determine whether the fault is dependency readiness or app logic.
5. For payment issues, inspect `command.payment.process_ipn`, `cron.payment_timeout`, and related order status logs.
6. For realtime issues, inspect WebSocket connection logs, `ws.notifications.connection`, and notification delivery logs.
7. If a release introduced the issue, rollback the Render image tag through Terraform or rerun the previous successful pipeline.
