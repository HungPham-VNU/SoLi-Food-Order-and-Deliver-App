import { HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ZodError } from 'zod';

export function asMediaRpcException(error: unknown): RpcException {
  if (error instanceof RpcException) return error;

  const statusCode =
    error instanceof ZodError
      ? HttpStatus.BAD_REQUEST
      : error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
  const message =
    error instanceof ZodError
      ? 'Invalid Media RPC payload.'
      : error instanceof Error
        ? error.message
        : 'Media service request failed.';

  return new RpcException({
    statusCode,
    code: `MEDIA_${HttpStatus[statusCode] ?? 'ERROR'}`,
    message,
  });
}
