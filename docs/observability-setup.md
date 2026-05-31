# Observability Setup

This repository uses:

- OpenTelemetry in `apps/api` for backend traces, metrics, and trace-correlated logs.
- Grafana Cloud as the backend for API observability through OTLP.
- Grafana Faro in `apps/web` for browser errors, Web Vitals, sessions, route changes, frontend traces, and source maps.
- Sentry in `apps/mobile` for mobile client errors, crashes, performance, releases, and source maps.
- PostHog in `apps/web` for product analytics.

Backend telemetry is vendor-neutral. The API uses the OpenTelemetry SDK and OTLP HTTP exporters to send traces, metrics, and logs directly to Grafana Cloud when a Grafana Cloud OTLP endpoint and credentials are configured.

Web telemetry uses the Grafana Cloud Frontend Observability collector URL from
`VITE_GRAFANA_FARO_COLLECTOR_URL`. Production web source maps are uploaded during
the Docker image build with `@grafana/faro-rollup-plugin` and the
`GRAFANA_FARO_SOURCEMAP_*` / `GRAFANA_CLOUD_STACK_ID` CI settings.

For operational instructions, see `OBSERVABILITY.md` at the repository root.
