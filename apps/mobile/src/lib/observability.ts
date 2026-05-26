import * as Sentry from '@sentry/react-native';

function numberFromEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 1);
}

export function initMobileObservability(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment:
      process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.EXPO_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: numberFromEnv(
      process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
  });
}

export function createRequestId(): string {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function captureMobileException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context ?? {})) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}

export { Sentry };
