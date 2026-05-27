# Observability

## Runtime Flow

- API: OpenTelemetry auto-instrumentation and custom spans export OTLP traces, metrics, and logs directly to Grafana Cloud over OTLP HTTP.
- Web: Sentry captures React errors/performance; PostHog captures page views and product events.
- Mobile: Sentry React Native captures JS/native errors; PostHog React Native captures lifecycle, screen views, and key events.

## Required Production Secrets

- Either `OTEL_EXPORTER_OTLP_ENDPOINT` plus `OTEL_EXPORTER_OTLP_HEADERS`, or `GRAFANA_CLOUD_OTLP_ENDPOINT`, `GRAFANA_CLOUD_OTLP_USERNAME_OR_INSTANCE_ID`, and `GRAFANA_CLOUD_OTLP_TOKEN`
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_WEB_PROJECT`, `SENTRY_MOBILE_PROJECT`
- `VITE_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_DSN`
- `VITE_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`

Do not commit real tokens. Store them in CI/CD or hosting-provider secret storage.

## Metadata

Set these on every deployment:

```env
APP_ENV=production
APP_VERSION=1.0.0
COMMIT_SHA=<git-sha>
VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0
VITE_COMMIT_SHA=<git-sha>
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_COMMIT_SHA=<git-sha>
```

## Local Checks

OTLP export is disabled when no endpoint is configured. To test direct export,
use the Grafana Cloud OpenTelemetry details page values:

```powershell
$env:GRAFANA_CLOUD_OTLP_ENDPOINT='https://otlp-gateway-prod-REGION.grafana.net/otlp'
$env:GRAFANA_CLOUD_OTLP_USERNAME_OR_INSTANCE_ID='<instance-id>'
$env:GRAFANA_CLOUD_OTLP_TOKEN='<access-policy-token>'
pnpm --filter api dev
```

Then call `GET /api/ready` or any API endpoint and check the Grafana Cloud
Explore views for traces, metrics, and logs with `service.name=uitfood-api`.

If you prefer the standard OpenTelemetry header variable instead, set
`OTEL_EXPORTER_OTLP_ENDPOINT` to the Grafana Cloud OTLP endpoint and
`OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64-instance-id-and-token>`.

## Privacy Defaults

- Backend logs redact authorization, cookies, tokens, secrets, passwords, API keys, payment signatures, and IP-like fields.
- Sentry has `sendDefaultPii` disabled.
- PostHog session replay is disabled by default on web and mobile.
- Analytics helpers filter common sensitive property names before capture.
