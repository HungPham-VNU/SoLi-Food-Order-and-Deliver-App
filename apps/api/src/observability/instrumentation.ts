import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { closeSentry, initSentry } from './sentry';

initSentry();

let sdk: NodeSDK | undefined;
let shuttingDown = false;

function otlpUrl(endpoint: string, signalPath: '/v1/traces' | '/v1/metrics') {
  const normalized = endpoint.replace(/\/+$/, '');
  if (normalized.endsWith('/v1/traces')) {
    return signalPath === '/v1/traces'
      ? normalized
      : normalized.replace(/\/v1\/traces$/, '/v1/metrics');
  }
  if (normalized.endsWith('/v1/metrics')) {
    return signalPath === '/v1/metrics'
      ? normalized
      : normalized.replace(/\/v1\/metrics$/, '/v1/traces');
  }
  return `${normalized}${signalPath}`;
}

function isHealthRequest(url?: string | null): boolean {
  const path = (url ?? '').split('?')[0];
  return (
    path === '/api/live' || path === '/api/ready' || path === '/api/health'
  );
}

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();

if (otlpEndpoint) {
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'uitfood-api',
      [ATTR_SERVICE_VERSION]: process.env.SENTRY_RELEASE ?? 'local',
      'deployment.environment':
        process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: otlpUrl(otlpEndpoint, '/v1/traces'),
    }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: otlpUrl(otlpEndpoint, '/v1/metrics'),
        }),
        exportIntervalMillis: 60_000,
        exportTimeoutMillis: 30_000,
      }),
    ],
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
  } finally {
    await closeSentry();
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdownTelemetry(signal).finally(() => process.exit(0));
  });
}
