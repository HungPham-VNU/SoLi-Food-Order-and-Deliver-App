import { SpanStatusCode, trace } from '@opentelemetry/api';
import { captureException } from './sentry';
import { redactValue } from './redaction';

const tracer = trace.getTracer('uitfood-api');

export async function runObserved<T>(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(
    name,
    {
      attributes: Object.fromEntries(
        Object.entries(attributes).filter(([, value]) => value !== undefined),
      ),
    },
    async (span) => {
      try {
        return await fn();
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error);
        }
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        captureException(error, {
          tags: { span: name },
          extras: { attributes: redactValue(attributes) },
        });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
