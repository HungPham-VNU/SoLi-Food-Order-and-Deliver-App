import * as Sentry from '@sentry/react';
import type { AxiosError } from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

function numberFromEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 1);
}

function escapedRegExp(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

export function initObservability(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    tracesSampleRate: numberFromEnv(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    integrations: [Sentry.browserTracingIntegration()],
    tracePropagationTargets: [/^\/api/, escapedRegExp(apiBaseUrl)],
    sendDefaultPii: false,
  });
}

export function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function addApiErrorBreadcrumb(error: AxiosError): void {
  Sentry.addBreadcrumb({
    category: 'api',
    level: 'error',
    message: `${error.config?.method?.toUpperCase() ?? 'GET'} ${error.config?.url ?? 'unknown'}`,
    data: {
      status: error.response?.status,
      requestId: error.config?.headers?.['x-request-id'],
    },
  });
}

export function captureApiError(error: AxiosError): void {
  const status = error.response?.status ?? 0;
  if (status < 500) return;

  Sentry.withScope((scope) => {
    scope.setTag('api.status', String(status));
    scope.setExtra('api.url', error.config?.url);
    scope.setExtra('api.method', error.config?.method);
    scope.setExtra('request_id', error.config?.headers?.['x-request-id']);
    Sentry.captureException(error);
  });
}

export { Sentry };
