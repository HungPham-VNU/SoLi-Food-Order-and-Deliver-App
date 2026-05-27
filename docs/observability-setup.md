# Observability Setup

This repository uses:

- OpenTelemetry in `apps/api` for backend traces, metrics, and trace-correlated logs.
- Grafana Cloud as the backend for API observability through OTLP.
- Sentry in `apps/web` and `apps/mobile` for client errors, crashes, performance, releases, and source maps.
- PostHog in `apps/web` and `apps/mobile` for product analytics and feature flags.

Backend telemetry is vendor-neutral. The API uses the OpenTelemetry SDK and OTLP HTTP exporters to send traces, metrics, and logs directly to Grafana Cloud when a Grafana Cloud OTLP endpoint and credentials are configured.

For operational instructions, see `OBSERVABILITY.md` at the repository root.
