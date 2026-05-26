import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { trace } from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';
import { redactHeaders } from './redaction';

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  startedAt: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function safeRequestId(req: Request): string {
  const incoming = firstHeader(req.headers['x-request-id']);
  if (incoming && incoming.length <= 128) return incoming;
  return randomUUID();
}

function requestPath(req: Request): string {
  return (req.path || req.originalUrl || req.url || '').split('?')[0] || '/';
}

function isHealthPath(path: string): boolean {
  return (
    path === '/api/live' || path === '/api/ready' || path === '/api/health'
  );
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const context: RequestContext = {
    requestId: safeRequestId(req),
    method: req.method,
    path: requestPath(req),
    startedAt: performance.now(),
  };

  res.setHeader('x-request-id', context.requestId);

  storage.run(context, () => {
    res.on('finish', () => {
      if (isHealthPath(context.path)) return;

      const span = trace.getActiveSpan()?.spanContext();
      const user = (req as Request & { user?: { id?: string } }).user;
      const durationMs = Math.round(performance.now() - context.startedAt);

      console.log(
        JSON.stringify({
          level: res.statusCode >= 500 ? 'error' : 'info',
          timestamp: new Date().toISOString(),
          event: 'http.request',
          requestId: context.requestId,
          traceId: span?.traceId,
          spanId: span?.spanId,
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
        }),
      );
    });

    next();
  });
}
