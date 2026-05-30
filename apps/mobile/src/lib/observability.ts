import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
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

  const environment =
    process.env.EXPO_PUBLIC_APP_ENV ??
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NODE_ENV;
  const release =
    process.env.EXPO_PUBLIC_SENTRY_RELEASE ??
    process.env.EXPO_PUBLIC_APP_VERSION;
  const dist =
    Application.nativeBuildVersion ??
    process.env.EXPO_PUBLIC_BUILD_NUMBER;

  Sentry.init({
    dsn,
    environment,
    release,
    dist,
    tracesSampleRate: numberFromEnv(
      process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    initialScope: {
      tags: {
        app_env: environment,
        app_version: process.env.EXPO_PUBLIC_APP_VERSION,
        commit_sha: process.env.EXPO_PUBLIC_COMMIT_SHA,
      },
    },
  });
}

export function createRequestId(): string {
  return Crypto.randomUUID();
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
