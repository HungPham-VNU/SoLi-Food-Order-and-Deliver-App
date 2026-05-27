import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { validate } from '../config/env.schema';
import { isHealthPath } from './observability-config';

const env = validate(process.env);

process.env.APP_ENV ??= env.APP_ENV;
process.env.APP_VERSION ??= env.APP_VERSION;
if (env.COMMIT_SHA) process.env.COMMIT_SHA ??= env.COMMIT_SHA;
process.env.OTEL_SERVICE_NAME ??= env.OTEL_SERVICE_NAME;
process.env.OTEL_TRACES_EXPORTER ??= env.OTEL_TRACES_EXPORTER;
process.env.OTEL_METRICS_EXPORTER ??= env.OTEL_METRICS_EXPORTER;
process.env.OTEL_LOGS_EXPORTER ??= env.OTEL_LOGS_EXPORTER;

let sdk: NodeSDK | undefined;
let shuttingDown = false;

function parseKeyValueList(value: string | undefined): Record<string, string> {
  if (!value) return {};

  return Object.fromEntries(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .flatMap((entry) => {
        const separator = entry.indexOf('=');
        if (separator <= 0) return [];

        const key = entry.slice(0, separator).trim();
        const rawValue = entry.slice(separator + 1).trim();
        if (!key || !rawValue) return [];

        try {
          return [[key, decodeURIComponent(rawValue)] as const];
        } catch {
          return [[key, rawValue] as const];
        }
      }),
  );
}

function otlpUrl(
  endpoint: string,
  signalPath: '/v1/traces' | '/v1/metrics' | '/v1/logs',
) {
  const normalized = endpoint.replace(/\/+$/, '');
  for (const knownPath of ['/v1/traces', '/v1/metrics', '/v1/logs'] as const) {
    if (normalized.endsWith(knownPath)) {
      return signalPath === knownPath
        ? normalized
        : normalized.replace(new RegExp(`${knownPath}$`), signalPath);
    }
  }

  return `${normalized}${signalPath}`;
}

function isHealthRequest(url?: string | null): boolean {
  const path = (url ?? '').split('?')[0];
  return isHealthPath(path);
}

const otlpEndpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
const tracesEnabled = env.OTEL_TRACES_EXPORTER.toLowerCase() !== 'none';
const metricsEnabled = env.OTEL_METRICS_EXPORTER.toLowerCase() !== 'none';
const logsEnabled = env.OTEL_LOGS_EXPORTER.toLowerCase() !== 'none';

if (
  otlpEndpoint?.match(/:4317(\/|$)/) &&
  (tracesEnabled || metricsEnabled || logsEnabled)
) {
  console.warn(
    JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      event: 'otel.endpoint_warning',
      message:
        'OTLP HTTP exporters are configured but endpoint uses port 4317 (gRPC). Use port 4318 for HTTP/protobuf.',
      endpoint: otlpEndpoint,
    }),
  );
}

if (otlpEndpoint && (tracesEnabled || metricsEnabled || logsEnabled)) {
  process.env.OTEL_TRACES_SAMPLER = env.OTEL_TRACES_SAMPLER;
  process.env.OTEL_TRACES_SAMPLER_ARG = String(env.OTEL_TRACES_SAMPLER_ARG);
  if (env.OTEL_EXPORTER_OTLP_HEADERS) {
    process.env.OTEL_EXPORTER_OTLP_HEADERS = env.OTEL_EXPORTER_OTLP_HEADERS;
  }

  const exporterHeaders = parseKeyValueList(env.OTEL_EXPORTER_OTLP_HEADERS);

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      ...parseKeyValueList(env.OTEL_RESOURCE_ATTRIBUTES),
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: env.APP_VERSION,
      'deployment.environment': env.APP_ENV ?? env.NODE_ENV ?? 'development',
      'commit.sha': env.COMMIT_SHA ?? 'local',
      'runtime.name': 'nodejs',
    }),
    traceExporter: tracesEnabled
      ? new OTLPTraceExporter({
          url: otlpUrl(otlpEndpoint, '/v1/traces'),
          headers: exporterHeaders,
        })
      : undefined,
    metricReaders: metricsEnabled
      ? [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url: otlpUrl(otlpEndpoint, '/v1/metrics'),
              headers: exporterHeaders,
            }),
            exportIntervalMillis: 60_000,
            exportTimeoutMillis: 30_000,
          }),
        ]
      : undefined,
    logRecordProcessors: logsEnabled
      ? [
          new BatchLogRecordProcessor(
            new OTLPLogExporter({
              url: otlpUrl(otlpEndpoint, '/v1/logs'),
              headers: exporterHeaders,
            }),
          ),
        ]
      : undefined,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) => isHealthRequest(request.url),
        },
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
}

export async function shutdownTelemetry(signal = 'manual'): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    await sdk?.shutdown();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        event: 'otel.shutdown_failed',
        signal,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
