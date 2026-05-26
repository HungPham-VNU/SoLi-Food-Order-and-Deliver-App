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

@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request | undefined>();

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
            },
            extras: {
              method: request?.method,
              path: request?.path,
              status,
            },
          });
        }

        return throwError(() => error);
      }),
    );
  }
}
