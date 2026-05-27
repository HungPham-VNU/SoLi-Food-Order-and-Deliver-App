import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const OBSERVABILITY_HEADERS = [
  'x-request-id',
  'traceparent',
  'tracestate',
  'sentry-trace',
  'baggage',
];

export function createCorsOptions(): CorsOptions {
  return {
    origin: (
      process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174'
    )
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
    allowedHeaders: [
      'Accept',
      'Authorization',
      'Content-Type',
      ...OBSERVABILITY_HEADERS,
    ],
    exposedHeaders: OBSERVABILITY_HEADERS,
  };
}
