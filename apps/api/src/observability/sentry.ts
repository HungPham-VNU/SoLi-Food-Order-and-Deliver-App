import * as Sentry from '@sentry/node';
import { redactHeaders, redactValue } from './redaction';

let initialized = false;

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 1);
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || initialized) return;

  const options: Parameters<typeof Sentry.init>[0] & {
    skipOpenTelemetrySetup?: boolean;
  } = {
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: numberFromEnv('SENTRY_TRACES_SAMPLE_RATE', 0.1),
    sendDefaultPii: false,
    skipOpenTelemetrySetup: !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    beforeSend(event) {
      if (event.request) {
        event.request.headers = redactHeaders(event.request.headers) as
          | Record<string, string>
          | undefined;
        delete event.request.cookies;
        delete event.request.query_string;
      }
      event.extra = redactValue(event.extra) as typeof event.extra;
      event.contexts = redactValue(event.contexts) as typeof event.contexts;
      return event;
    },
  };

  Sentry.init(options);

  initialized = true;
}

export function isSentryEnabled(): boolean {
  return initialized;
}

export function captureException(
  error: unknown,
  context?: {
    tags?: Record<string, string>;
    extras?: Record<string, unknown>;
  },
): void {
  if (!initialized) return;

  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context?.tags ?? {})) {
      scope.setTag(key, value);
    }
    for (const [key, value] of Object.entries(context?.extras ?? {})) {
      scope.setExtra(key, redactValue(value));
    }
    Sentry.captureException(error);
  });
}

export function setupSentryExpressErrorHandler(app: unknown): void {
  if (!initialized) return;
  Sentry.setupExpressErrorHandler(
    app as Parameters<typeof Sentry.setupExpressErrorHandler>[0],
  );
}

export async function closeSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized) return;
  await Sentry.close(timeoutMs);
}
