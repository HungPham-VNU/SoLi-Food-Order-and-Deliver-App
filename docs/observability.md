# Observability

UITFood uses a production MVP observability setup:

- Sentry captures API, web, and mobile exceptions with release/environment tags.
- OpenTelemetry exports API traces, metrics, and logs directly to Grafana Cloud over OTLP HTTP when configured.
- The API emits JSON logs with request IDs, trace IDs, route, status, duration, and safe context.
- Render health checks use API readiness and web container liveness endpoints.

## Runtime Configuration

API environment variables:

```env
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=sha-<git-sha>
SENTRY_TRACES_SAMPLE_RATE=0.1

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
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_RELEASE=sha-<git-sha>
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

Mobile build-time variables:

```env
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_SENTRY_ENVIRONMENT=production
EXPO_PUBLIC_SENTRY_RELEASE=sha-<git-sha>
EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

CI variables and secrets:

- `SENTRY_AUTH_TOKEN` as a GitHub secret.
- `SENTRY_ORG` as a GitHub variable.
- `SENTRY_WEB_PROJECT` and `SENTRY_MOBILE_PROJECT` as GitHub variables.
- `VITE_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_DSN`, and sample-rate variables as GitHub variables.

If DSNs are empty, Sentry is disabled. If neither `OTEL_EXPORTER_OTLP_ENDPOINT` nor `GRAFANA_CLOUD_OTLP_ENDPOINT` is set, API OTLP export is disabled while JSON logs and request IDs remain active.

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
- HTTP method, path, status, and duration
- `cfRay` when Render/Cloudflare forwards it
- user ID when already available on the request

The redaction layer removes sensitive headers and common secret fields, including auth cookies, bearer tokens, FCM tokens, payment hashes/signatures, SMTP credentials, Cloudinary secrets, and explicitly labelled IP fields. Do not log request bodies, payment payloads, raw addresses, or provider credentials.

## Dashboards and Alerts

Minimum dashboard panels:

- API request rate, p95 latency, and 5xx rate.
- API readiness failures for Redis and Postgres.
- Payment IPN failures and payment timeout task errors.
- Order timeout task errors.
- Notification delivery failures and WebSocket connection errors.
- Web and mobile Sentry issue count by release.

Minimum alerts:

- `/api/ready` failing for 2 consecutive checks.
- API 5xx rate above 2% for 5 minutes.
- p95 API latency above 2 seconds for 10 minutes.
- Payment IPN error spike.
- Notification delivery failure spike.
- New Sentry issue in production on the latest release.

## Incident Runbook

1. Open Render service logs and filter by `requestId` if a user report includes it.
2. Search Sentry by release, environment, and request ID.
3. Check `/api/ready` to determine whether the fault is dependency readiness or app logic.
4. For payment issues, inspect `command.payment.process_ipn`, `cron.payment_timeout`, and related order status logs.
5. For realtime issues, inspect WebSocket connection breadcrumbs, `ws.notifications.connection`, and notification delivery logs.
6. If a release introduced the issue, rollback the Render image tag through Terraform or rerun the previous successful pipeline.
