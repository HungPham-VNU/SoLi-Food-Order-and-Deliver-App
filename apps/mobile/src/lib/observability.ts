import * as Sentry from '@sentry/react-native';
import * as Crypto from 'expo-crypto';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
    release: process.env.EXPO_PUBLIC_SENTRY_RELEASE ?? 'local',
    tracesSampleRate: Number(
      process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1',
    ),
  });
}

export { Sentry };

export function createRequestId(): string {
  return Crypto.randomUUID();
}

export function captureMobileException(
  error: unknown,
  context?: Record<string, string | number | undefined>,
): void {
  if (__DEV__) {
    console.error('[mobile]', error, context);
  }

  Sentry.captureException(error, { extra: context });
}
