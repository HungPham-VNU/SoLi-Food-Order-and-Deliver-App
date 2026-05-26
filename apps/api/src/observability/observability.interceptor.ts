import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, throwError } from 'rxjs';
import { getRequestContext } from './request-context';
import { captureException } from './sentry';

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const transport = context.getType<string>();
    const request =
      transport === 'http'
        ? context.switchToHttp().getRequest<Request | undefined>()
        : undefined;

    return next.handle().pipe(
      catchError((error: unknown) => {
        const status =
          error instanceof HttpException ? error.getStatus() : undefined;

        if (!status || status >= 500) {
          const requestContext = getRequestContext();
          captureException(error, {
            tags: {
              request_id: requestContext?.requestId ?? 'unknown',
              handler: context.getHandler().name || 'unknown',
              transport,
            },
            extras: this.exceptionExtras(context, request, status),
          });
        }

        return throwError(() => error);
      }),
    );
  }

  private exceptionExtras(
    context: ExecutionContext,
    request: Request | undefined,
    status: number | undefined,
  ): Record<string, unknown> {
    const transport = context.getType<string>();
    const base = {
      transport,
      status,
    };

    if (transport === 'http') {
      return {
        ...base,
        method: request?.method,
        path: request?.path,
      };
    }

    if (transport === 'ws') {
      const ws = context.switchToWs();
      const client = objectRecord(ws.getClient<unknown>());
      const data = ws.getData<unknown>();

      return {
        ...base,
        clientId: typeof client?.id === 'string' ? client.id : undefined,
        dataType: Array.isArray(data) ? 'array' : typeof data,
      };
    }

    if (transport === 'rpc') {
      const rpc = context.switchToRpc();
      const rpcContext = rpc.getContext<unknown>();
      const data = rpc.getData<unknown>();

      return {
        ...base,
        rpcContextType:
          rpcContext && typeof rpcContext === 'object'
            ? rpcContext.constructor?.name
            : typeof rpcContext,
        dataType: Array.isArray(data) ? 'array' : typeof data,
      };
    }

    return base;
  }
}
