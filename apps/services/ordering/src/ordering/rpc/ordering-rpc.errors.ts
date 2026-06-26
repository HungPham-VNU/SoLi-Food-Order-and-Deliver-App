import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ZodError } from 'zod';

const logger = new Logger('OrderingRpcErrors');

export function asOrderingRpcException(error: unknown): RpcException {
  if (error instanceof RpcException) return error;

  if (error instanceof HttpException) {
    const statusCode = error.getStatus();
    return new RpcException({
      statusCode,
      code: error.constructor.name,
      message: normalizeMessage(error.getResponse(), error.message),
      retryable: statusCode >= 500,
    });
  }

  if (error instanceof ZodError) {
    return new RpcException({
      statusCode: 400,
      code: BadRequestException.name,
      message: 'Invalid Ordering RPC payload.',
      retryable: false,
    });
  }

  logger.error(
    `Unexpected Ordering RPC error: ${(error as Error).message}`,
    (error as Error).stack,
  );
  return new RpcException({
    statusCode: 500,
    code: InternalServerErrorException.name,
    message: 'Ordering service request failed.',
    retryable: true,
  });
}

function normalizeMessage(response: unknown, fallback: string): string {
  if (!response || typeof response !== 'object') return fallback;
  const message = (response as Record<string, unknown>).message;
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' ? message : fallback;
}
