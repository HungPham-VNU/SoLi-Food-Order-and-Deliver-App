import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { metrics, trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import type { NextFunction, Request, Response } from 'express';
import { isHealthPath, isOtelLogsEnabled } from './observability-config';
import { toLogAttributes } from './otel-attributes';
import { redactHeaders } from './redaction';

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  startedAt: number;
  traceId?: string;
  spanId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._~:-]{1,128}$/;
const meter = metrics.getMeter(process.env.OTEL_SERVICE_NAME ?? 'uitfood-api');
const requestCount = meter.createCounter('api.http.requests', {
  description: 'Total API HTTP requests',
});
const errorCount = meter.createCounter('api.http.errors', {
  description: 'Total API HTTP requests with 5xx responses',
});
const requestDuration = meter.createHistogram('api.http.request.duration_ms', {
  description: 'API HTTP request duration',
  unit: 'ms',
});
const activeRequests = meter.createUpDownCounter('api.http.active_requests', {
  description: 'Active API HTTP requests',
});
const otelLogger = logs.getLogger(
  process.env.OTEL_SERVICE_NAME ?? 'uitfood-api',
);

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function safeRequestId(req: Request): string {
  const incoming = firstHeader(req.headers['x-request-id']);
  if (incoming && REQUEST_ID_PATTERN.test(incoming)) return incoming;
  return randomUUID();
}

function requestPath(req: Request): string {
  return (req.path || req.originalUrl || req.url || '').split('?')[0] || '/';
}

function responseLogLevel(statusCode: number): 'error' | 'warn' | 'info' {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
}

function responseSeverity(statusCode: number): SeverityNumber {
  if (statusCode >= 500) return SeverityNumber.ERROR;
  if (statusCode >= 400) return SeverityNumber.WARN;
  return SeverityNumber.INFO;
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const span = trace.getActiveSpan()?.spanContext();
  const context: RequestContext = {
    requestId: safeRequestId(req),
    method: req.method,
    path: requestPath(req),
    startedAt: performance.now(),
    traceId: span?.traceId,
    spanId: span?.spanId,
  };

  res.setHeader('x-request-id', context.requestId);

  storage.run(context, () => {
    const metricBase = {
      'http.request.method': context.method,
      'url.path': context.path,
    };
    let activeDecremented = false;

    function decrementActiveRequests() {
      if (activeDecremented) return;
      activeDecremented = true;
      activeRequests.add(-1, metricBase);
    }

    activeRequests.add(1, metricBase);

    res.on('finish', () => {
      const user = (req as Request & { user?: { id?: string } }).user;
      const durationMs = Math.round(performance.now() - context.startedAt);
      const metricAttributes = {
        ...metricBase,
        'http.response.status_code': res.statusCode,
      };

      decrementActiveRequests();

      if (isHealthPath(context.path)) return;

      requestCount.add(1, metricAttributes);
      requestDuration.record(durationMs, metricAttributes);
      if (res.statusCode >= 500) {
        errorCount.add(1, metricAttributes);
      }

      const record = {
        level: responseLogLevel(res.statusCode),
        timestamp: new Date().toISOString(),
        event: 'http.request',
        service: process.env.OTEL_SERVICE_NAME ?? 'uitfood-api',
        environment:
          process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
        version: process.env.APP_VERSION,
        commitSha: process.env.COMMIT_SHA,
        requestId: context.requestId,
        traceId: context.traceId,
        spanId: context.spanId,
        method: context.method,
        path: context.path,
        statusCode: res.statusCode,
        durationMs,
        userId: user?.id,
        cfRay: firstHeader(req.headers['cf-ray']),
        requestHeaders: redactHeaders({
          'user-agent': req.headers['user-agent'],
          'x-forwarded-proto': req.headers['x-forwarded-proto'],
        }),
      };

      if (isOtelLogsEnabled()) {
        otelLogger.emit({
          eventName: 'http.request',
          severityNumber: responseSeverity(res.statusCode),
          severityText: record.level,
          body: `${context.method} ${context.path} ${res.statusCode}`,
          attributes: toLogAttributes(record),
        });
      }

      console.log(JSON.stringify(record));
    });

    res.on('close', () => {
      decrementActiveRequests();
    });

    next();
  });
}
