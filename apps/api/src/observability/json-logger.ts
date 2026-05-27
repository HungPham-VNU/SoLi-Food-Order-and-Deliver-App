import type { LoggerService, LogLevel } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import type { LogBody } from '@opentelemetry/api-logs';
import { isOtelLogsEnabled } from './observability-config';
import { toLogAttributes } from './otel-attributes';
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

const OTEL_LOGGER = logs.getLogger(
  process.env.OTEL_SERVICE_NAME ?? 'uitfood-api',
);

const OTEL_SEVERITY: Record<LogLevel, SeverityNumber> = {
  fatal: SeverityNumber.FATAL,
  error: SeverityNumber.ERROR,
  warn: SeverityNumber.WARN,
  log: SeverityNumber.INFO,
  debug: SeverityNumber.DEBUG,
  verbose: SeverityNumber.TRACE,
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
      environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
      version: process.env.APP_VERSION,
      commitSha: process.env.COMMIT_SHA,
      context,
      requestId: requestContext?.requestId,
      traceId: span?.traceId,
      spanId: span?.spanId,
      message: normalizedMessage,
      stack: stack ? redactString(stack) : undefined,
      extras: extras.length > 0 ? redactValue(extras) : undefined,
    };

    this.emitOpenTelemetryLog(level, record, normalizedMessage);

    const line = JSON.stringify(record);
    if (level === 'error' || level === 'fatal') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  private emitOpenTelemetryLog(
    level: LogLevel,
    record: Record<string, unknown>,
    body: unknown,
  ): void {
    if (!isOtelLogsEnabled()) {
      return;
    }

    OTEL_LOGGER.emit({
      severityNumber: OTEL_SEVERITY[level],
      severityText: level === 'log' ? 'info' : level,
      body: body as LogBody,
      attributes: toLogAttributes(record, { omit: ['message'] }),
    });
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
    if (typeof first === 'string' && first.includes('\n')) {
      stack = first;
      extras.shift();
    }

    return { context, stack, extras };
  }
}
