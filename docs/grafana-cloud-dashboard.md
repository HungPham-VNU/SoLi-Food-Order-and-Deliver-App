# Grafana Cloud Dashboard

This repository includes a Grafana dashboard for the deployed API:

```txt
infra/grafana/dashboards/uitfood-api-telemetry.json
```

## Import

1. Open Grafana Cloud.
2. Go to **Dashboards > New > Import**.
3. Upload `infra/grafana/dashboards/uitfood-api-telemetry.json`.
4. When Grafana prompts for variables, select your Grafana Cloud data sources:
   - `DS_PROMETHEUS`: Grafana Cloud Metrics / Prometheus
   - `DS_LOKI`: Grafana Cloud Logs / Loki
   - `DS_TEMPO`: Grafana Cloud Traces / Tempo
5. Keep `service` as `uitfood-api`.
6. Start with `environment = All`; narrow it to `production` after data appears.

## What It Uses

The dashboard is based on the API metrics emitted in
`apps/api/src/observability/request-context.ts`:

- `api.http.requests`
- `api.http.errors`
- `api.http.request.duration_ms`
- `api.http.active_requests`

Grafana Cloud stores OTLP metrics with Prometheus-compatible names. The dashboard
queries the common translated names:

- `api_http_requests_total` or `api_http_requests`
- `api_http_errors_total` or `api_http_errors`
- `api_http_request_duration_ms_bucket`
- `api_http_request_duration_ms_milliseconds_bucket`
- `api_http_active_requests`

Logs use native OTLP/Loki fields such as `service_name`,
`deployment_environment`, `severity_text`, `event`, and `trace_id`.

Traces use Tempo TraceQL filters:

```traceql
{ resource.service.name =~ "$service" && resource.deployment.environment =~ "$environment" }
```

## If Panels Are Empty

Use **Explore** to confirm these first:

```promql
sort_desc(count by (__name__)({__name__=~"api_http_.*"}))
```

```logql
{service_name="uitfood-api"}
```

```traceql
{ resource.service.name = "uitfood-api" }
```

If the Discovery row shows different metric names, edit only the affected panel
queries rather than trying another generic template. Generic templates usually
fail here because the app uses custom OpenTelemetry metric names instead of
framework-specific metric names.
