import { HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ZodError } from 'zod';

/**
 * Maps any thrown error to the stable Promotion RPC error envelope. Gateway and
 * Ordering callers translate this back to an HTTP status/code.
 */
export function asPromotionRpcException(error: unknown): RpcException {
  if (error instanceof RpcException) return error;

  const statusCode =
    error instanceof ZodError
      ? HttpStatus.BAD_REQUEST
      : error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
  const message =
    error instanceof ZodError
      ? 'Invalid Promotion RPC payload.'
      : error instanceof Error
        ? error.message
        : 'Promotion service request failed.';

  return new RpcException({
    statusCode,
    code: `PROMOTION_${HttpStatus[statusCode] ?? 'ERROR'}`,
    message,
    retryable: statusCode >= 500,
  });
}
