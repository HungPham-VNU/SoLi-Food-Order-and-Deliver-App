# Observability

## Runtime Flow

- API: OpenTelemetry auto-instrumentation and custom spans export OTLP traces, metrics, and route-grouped logs directly to Grafana Cloud over OTLP HTTP.
- Web: Grafana Faro captures browser errors, logs, Web Vitals, sessions, route changes, and frontend traces; PostHog captures page views and product events.
- Mobile: Sentry React Native captures JS/native errors; PostHog React Native captures lifecycle, screen views, and key events.

## Required Production Secrets

- Either `OTEL_EXPORTER_OTLP_ENDPOINT` plus `OTEL_EXPORTER_OTLP_HEADERS`, or `GRAFANA_CLOUD_OTLP_ENDPOINT`, `GRAFANA_CLOUD_OTLP_USERNAME_OR_INSTANCE_ID`, and `GRAFANA_CLOUD_OTLP_TOKEN`
- `VITE_GRAFANA_FARO_COLLECTOR_URL`
- `GRAFANA_FARO_SOURCEMAP_ENDPOINT`, `GRAFANA_FARO_SOURCEMAP_API_KEY`, `GRAFANA_FARO_APP_ID`, and `GRAFANA_CLOUD_STACK_ID`
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`
- `EXPO_PUBLIC_SENTRY_DSN`
- `VITE_POSTHOG_KEY`

Do not commit real tokens. Store them in CI/CD or hosting-provider secret storage.
`GRAFANA_FARO_SOURCEMAP_API_KEY` is a Docker BuildKit secret for the deployed
web image build, not a `VITE_` variable.

## Metadata

Set these on every deployment:

```env
APP_ENV=production
APP_VERSION=1.0.0
COMMIT_SHA=<git-sha>
VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0
VITE_COMMIT_SHA=<git-sha>
VITE_GRAFANA_FARO_APP_NAME=uitfood-web
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_COMMIT_SHA=<git-sha>
```

## Local Checks

OTLP export is disabled when no endpoint is configured. To test direct API export,
use the Grafana Cloud OpenTelemetry details page values:

```powershell
$env:GRAFANA_CLOUD_OTLP_ENDPOINT='https://otlp-gateway-prod-REGION.grafana.net/otlp'
$env:GRAFANA_CLOUD_OTLP_USERNAME_OR_INSTANCE_ID='<instance-id>'
$env:GRAFANA_CLOUD_OTLP_TOKEN='<access-policy-token>'
pnpm --filter api dev
```

Then call `GET /api/ready` or any API endpoint and check the Grafana Cloud
Explore views for traces, metrics, and logs with `service.name=uitfood-api`.
Route telemetry for monitored API families is labelled with `app.route.group`
and `http.route`, including `menu-items`, `restaurants`, `search`,
`promotions`, `carts`, `my`, `restaurant`, and `payments`.

If you prefer the standard OpenTelemetry header variable instead, set
`OTEL_EXPORTER_OTLP_ENDPOINT` to the Grafana Cloud OTLP endpoint and
`OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64-instance-id-and-token>`.

To test Web Faro locally, set `VITE_GRAFANA_FARO_COLLECTOR_URL` to the Grafana
Cloud Frontend Observability collector URL and run `pnpm --filter web dev`.
Leave it empty to keep Faro disabled in local development.

## Grafana Dashboard

Import `infra/grafana/dashboards/uitfood-api-telemetry.json` in Grafana Cloud to
view API metrics, logs, and traces in one place. See
`docs/grafana-cloud-dashboard.md` for import steps and query troubleshooting.

Use Grafana Cloud Frontend Observability for web browser sessions, errors, route
changes, Web Vitals, and uploaded source maps.

## Privacy Defaults

- Backend logs redact authorization, cookies, tokens, secrets, passwords, API keys, payment signatures, and IP-like fields.
- Backend request logs include `routeTemplate`, `routeGroup`, and `routeScope` when applicable.
- Web Faro only sets user ID; it does not send user email or name.
- Faro geolocation tracking is disabled client-side.
- PostHog session replay is disabled by default on web and mobile.
- Analytics helpers filter common sensitive property names before capture.
