# Grafana Cloud Dashboard

The old single-process API dashboard was removed with the microservice cutover.
Create backend dashboards per service, or use a `service_name` variable that can
select the gateway and service processes.

```txt
uitfood-gateway
uitfood-identity
uitfood-media
uitfood-notification
uitfood-catalog
uitfood-promotion
uitfood-payment
uitfood-review
uitfood-ordering
uitfood-reporting
```

## Import

1. Open Grafana Cloud.
2. Go to **Dashboards > New > Import**.
3. Upload the service dashboard JSON after it is created.
4. When Grafana prompts for variables, select your Grafana Cloud data sources:
   - `DS_PROMETHEUS`: Grafana Cloud Metrics / Prometheus
   - `DS_LOKI`: Grafana Cloud Logs / Loki
   - `DS_TEMPO`: Grafana Cloud Traces / Tempo
5. Pick the relevant `service_name`, such as `uitfood-gateway`.
6. Start with `environment = All`; narrow it to `production` after data appears.

## What It Uses

Start with gateway and service metrics emitted by the deployed processes:

- request count
- request errors
- request duration
- active requests

Grafana Cloud stores OTLP metrics with Prometheus-compatible names. The dashboard
queries the common translated names:

- Service-specific HTTP request counters
- Service-specific HTTP error counters
- Service-specific request duration histograms
- Runtime process metrics

Logs use native OTLP/Loki fields such as `service_name`,
`deployment_environment`, `severity_text`, `event`, and `trace_id`.

Traces use Tempo TraceQL filters:

```traceql
{ resource.service.name =~ "$service" && resource.deployment.environment =~ "$environment" }
```

## If Panels Are Empty

Use **Explore** to confirm these first:

```promql
sort_desc(count by (__name__)({service_name=~"uitfood-.*"}))
```

```logql
{service_name="uitfood-gateway"}
```

```traceql
{ resource.service.name = "uitfood-gateway" }
```

If the Discovery row shows different metric names, edit only the affected panel
queries rather than trying another generic template. Generic templates usually
fail here because the app uses custom OpenTelemetry metric names instead of
framework-specific metric names.
