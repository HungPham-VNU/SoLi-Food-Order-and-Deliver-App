import {
  FaroErrorBoundary,
  LogLevel,
  ReactIntegration,
  createReactRouterV7DataOptions,
  getWebInstrumentations,
  initializeFaro,
  type Faro,
} from '@grafana/faro-react';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import type { AxiosError } from 'axios';
import { matchRoutes } from 'react-router-dom';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const appName = import.meta.env.VITE_GRAFANA_FARO_APP_NAME ?? 'uitfood-web';

let faroClient: Faro | undefined;

function escapedRegExp(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.join(',');
  return String(value);
}

function compactContext(
  values: Record<string, string | number | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values)
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

function requestIdFromError(error: AxiosError): string | undefined {
  const headers = error.config?.headers as Record<string, unknown> | undefined;
  return asString(headers?.['x-request-id']);
}

function apiErrorContext(error: AxiosError): Record<string, string> {
  return compactContext({
    status: error.response?.status,
    request_id: requestIdFromError(error),
    method: error.config?.method?.toUpperCase(),
    url: error.config?.url,
  });
}

export function initObservability(): void {
  if (faroClient) return;

  const collectorUrl = import.meta.env.VITE_GRAFANA_FARO_COLLECTOR_URL;
  if (!collectorUrl) return;

  const environment = import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE;
  const appVersion = import.meta.env.VITE_APP_VERSION ?? 'local';
  const commitSha = import.meta.env.VITE_COMMIT_SHA;

  faroClient = initializeFaro({
    url: collectorUrl,
    app: {
      name: appName,
      version: appVersion,
      environment,
      gitHash: commitSha,
      bundleId: commitSha ?? appVersion,
    },
    trackGeolocation: false,
    consoleInstrumentation: {
      disabledLevels: [LogLevel.DEBUG, LogLevel.TRACE, LogLevel.LOG],
      consoleErrorAsLog: true,
    },
    instrumentations: [
      ...getWebInstrumentations(),
      new TracingInstrumentation({
        instrumentationOptions: {
          propagateTraceHeaderCorsUrls: [/^\/api/, escapedRegExp(apiBaseUrl)],
        },
      }),
      new ReactIntegration({
        router: createReactRouterV7DataOptions({ matchRoutes }),
      }),
    ],
  });
}

export function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function addApiErrorBreadcrumb(error: AxiosError): void {
  const status = error.response?.status ?? 0;

  faroClient?.api.pushLog(
    [
      `${error.config?.method?.toUpperCase() ?? 'GET'} ${error.config?.url ?? 'unknown'}`,
    ],
    {
      level: status >= 500 ? LogLevel.ERROR : LogLevel.WARN,
      context: apiErrorContext(error),
    },
  );
}

export function captureApiError(error: AxiosError): void {
  const status = error.response?.status ?? 0;
  if (status < 500) return;

  faroClient?.api.pushError(error, {
    type: 'api.error',
    context: apiErrorContext(error),
  });
}

export function setObservabilityUser(userId: string): void {
  faroClient?.api.setUser({ id: userId });
}

export function resetObservabilityUser(): void {
  faroClient?.api.resetUser();
}

export function pushObservabilityEvent(
  name: string,
  attributes?: Record<string, string>,
): void {
  faroClient?.api.pushEvent(name, attributes);
}

export { FaroErrorBoundary };
