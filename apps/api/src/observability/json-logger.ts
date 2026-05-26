import type { LoggerService, LogLevel } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { getRequestContext } from './request-context';
import { redactString, redactValue } from './redaction';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
};

const LOG_LEVEL_ALIASES: Record<string, LogLevel> = {
  fatal: 'fatal',
  error: 'error',
  warn: 'warn',
  warning: 'warn',
  info: 'log',
  log: 'log',
  debug: 'debug',
  verbose: 'verbose',
};

export class JsonLogger implements LoggerService {
  private readonly minLevel =
    LOG_LEVEL_ALIASES[(process.env.LOG_LEVEL ?? 'log').toLowerCase()] ?? 'log';

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  private write(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[this.minLevel]) return;

    const requestContext = getRequestContext();
    const span = trace.getActiveSpan()?.spanContext();
    const { context, stack, extras } = this.parseOptionalParams(optionalParams);
    const normalizedMessage =
      typeof message === 'string'
        ? redactString(message)
        : redactValue(message);

    const record = {
      level: level === 'log' ? 'info' : level,
      timestamp: new Date().toISOString(),
      service: process.env.OTEL_SERVICE_NAME ?? 'uitfood-api',
      environment:
        process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      release: process.env.SENTRY_RELEASE,
      context,
      requestId: requestContext?.requestId,
      traceId: span?.traceId,
      spanId: span?.spanId,
      message: normalizedMessage,
      stack: stack ? redactString(stack) : undefined,
      extras: extras.length > 0 ? redactValue(extras) : undefined,
    };

    const line = JSON.stringify(record);
    if (level === 'error' || level === 'fatal') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  private parseOptionalParams(optionalParams: unknown[]): {
    context?: string;
    stack?: string;
    extras: unknown[];
  } {
    const extras = [...optionalParams];
    let context: string | undefined;
    let stack: string | undefined;

    const last = extras.at(-1);
    if (typeof last === 'string' && !last.includes('\n')) {
      context = last;
      extras.pop();
    }

    const first = extras[0];
    if (typeof first === 'string') {
      stack = first;
      extras.shift();
    }

    return { context, stack, extras };
  }
}
