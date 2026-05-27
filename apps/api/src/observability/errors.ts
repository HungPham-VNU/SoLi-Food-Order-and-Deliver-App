import { SpanStatusCode, trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { isOtelLogsEnabled } from './observability-config';
import { toLogAttributes } from './otel-attributes';
import { redactValue } from './redaction';

type AttributeValue = string | number | boolean;
const otelLogger = logs.getLogger(
  process.env.OTEL_SERVICE_NAME ?? 'uitfood-api',
);

function primitiveAttributes(
  attributes: Record<string, unknown>,
): Record<string, AttributeValue> {
  const safeAttributes: Record<string, AttributeValue> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      safeAttributes[key] = value;
    }
  }

  return safeAttributes;
}

export function recordException(
  error: unknown,
  attributes: Record<string, unknown> = {},
): void {
  const span = trace.getActiveSpan();
  const spanContext = span?.spanContext();
  const message = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : typeof error;
  const safeAttributes = redactValue(attributes) as Record<string, unknown>;

  if (span) {
    if (error instanceof Error) {
      span.recordException(error);
    } else {
      span.addEvent('exception', {
        'exception.message': message,
        'exception.type': errorName,
      });
    }

    span.setAttributes(primitiveAttributes(safeAttributes));
    span.setStatus({ code: SpanStatusCode.ERROR, message });
  }

  const record = {
    level: 'error',
    timestamp: new Date().toISOString(),
    event: 'app.exception',
    service: process.env.OTEL_SERVICE_NAME ?? 'uitfood-api',
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
    version: process.env.APP_VERSION,
    commitSha: process.env.COMMIT_SHA,
    traceId: spanContext?.traceId,
    spanId: spanContext?.spanId,
    errorName,
    message,
    attributes: safeAttributes,
  };

  if (isOtelLogsEnabled()) {
    otelLogger.emit({
      eventName: 'app.exception',
      severityNumber: SeverityNumber.ERROR,
      severityText: 'error',
      body: message,
      attributes: {
        ...toLogAttributes(record, { omit: ['attributes'] }),
        ...toLogAttributes(safeAttributes, { prefix: 'error.attribute.' }),
      },
      exception: error,
    });
  }

  console.error(JSON.stringify(record));
}
