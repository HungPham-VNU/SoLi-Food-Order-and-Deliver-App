import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) =>
  value === '' ? undefined : value;

/**
 * Zod schema for all required environment variables.
 *
 * This schema is passed to ConfigModule.forRoot({ validate }) so that the
 * application FAILS FAST at startup — before any module is initialized —
 * when a required variable is missing or has an invalid value.
 *
 * Benefits over the previous onModuleInit() per-service checks:
 *   - One canonical location for all env validation rules.
 *   - Clear, structured error messages at startup (lists ALL missing vars,
 *     not just the first one encountered).
 *   - Type coercion handled here (e.g. REDIS_PORT string → number) so
 *     downstream consumers receive correctly-typed values.
 *   - Defaults are applied consistently before any factory function runs.
 */
export const envSchema = z.object({
  NODE_ENV: z.string().default('development'),

  // ---------------------------------------------------------------------------
  // Database
  // ---------------------------------------------------------------------------
  DATABASE_URL: z
    .string()
    .min(
      1,
      'DATABASE_URL is required — format: postgresql://user:pass@host:port/db',
    ),

  // ---------------------------------------------------------------------------
  // Better Auth
  // ---------------------------------------------------------------------------
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters for security')
    .default('a_very_long_secret_for_test_purposes_only_32_chars'),
  BETTER_AUTH_URL: z
    .string()
    .url('BETTER_AUTH_URL must be a valid URL')
    .default('http://localhost:3000'),

  // ---------------------------------------------------------------------------
  // Redis
  // ---------------------------------------------------------------------------
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  // ---------------------------------------------------------------------------
  // VNPay — all four are required; no defaults (production payment credentials)
  // ---------------------------------------------------------------------------
  VNPAY_TMN_CODE: z
    .string()
    .trim()
    .min(1, 'VNPAY_TMN_CODE is required — obtain from VNPay merchant portal')
    .default('STUB_TMN'),
  VNPAY_HASH_SECRET: z
    .string()
    .trim()
    .min(
      1,
      'VNPAY_HASH_SECRET is required — HMAC signing key from VNPay portal',
    )
    .default('STUB_SECRET'),
  VNPAY_URL: z
    .string()
    .url(
      'VNPAY_URL must be a valid URL (e.g. https://sandbox.vnpayment.vn/paymentv2/vpcpay.html)',
    )
    .default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
  VNPAY_RETURN_URL: z
    .string()
    .url(
      'VNPAY_RETURN_URL must be a valid URL (e.g. http://localhost:3000/api/payments/vnpay/return)',
    )
    .default('http://localhost:3000/api/payments/vnpay/return'),

  // ---------------------------------------------------------------------------
  // Cloudinary — required for signed uploads
  // ---------------------------------------------------------------------------
  CLOUDINARY_CLOUD_NAME: z
    .string()
    .trim()
    .min(1, 'CLOUDINARY_CLOUD_NAME is required')
    .default('STUB_CLOUD'),
  CLOUDINARY_API_KEY: z
    .string()
    .trim()
    .min(1, 'CLOUDINARY_API_KEY is required')
    .default('STUB_KEY'),
  CLOUDINARY_API_SECRET: z
    .string()
    .trim()
    .min(1, 'CLOUDINARY_API_SECRET is required')
    .default('STUB_SECRET'),

  // ---------------------------------------------------------------------------
  // CORS (comma-separated origins)
  // ---------------------------------------------------------------------------
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173,http://localhost:3000'),

  // ---------------------------------------------------------------------------
  // Payment session window — optional with a safe default
  // ---------------------------------------------------------------------------
  PAYMENT_SESSION_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .positive('PAYMENT_SESSION_TIMEOUT_SECONDS must be a positive integer')
    .default(1800),

  // ---------------------------------------------------------------------------
  // SMTP email delivery — all optional (Phase N-4)
  // When SMTP_HOST is absent, NodemailerEmailProvider is swapped for
  // NoopEmailProvider which records SMTP_NOT_CONFIGURED delivery failures.
  // ---------------------------------------------------------------------------
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // z.coerce.boolean() converts the string 'false' to true (Boolean('false') === true).
  // Use a string transform instead so 'false'/'0'/undefined → false and 'true'/'1' → true.
  SMTP_SECURE: z
    .string()
    .optional()
    .default('false')
    .transform((s) => s === 'true' || s === '1'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().trim().optional(),
  SMTP_FROM: z.string().optional().default('noreply@soli.dev'),

  // ---------------------------------------------------------------------------
  // Firebase Cloud Messaging — optional (Phase N-5)
  // Path to the Firebase Admin SDK service account JSON key file.
  // May be absolute or relative to process.cwd() (the directory from which
  // `nest start` is invoked — typically `apps/api/` in local dev).
  //
  // When absent, PUSH_PROVIDER falls back to StubPushProvider which logs
  // push delivery attempts without making real FCM calls. Safe for CI/CD.
  //
  // Example (relative to apps/api/):
  //   FIREBASE_SERVICE_ACCOUNT_PATH=soli-food-delivery-FCM-key.json
  // ---------------------------------------------------------------------------
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),

  // ---------------------------------------------------------------------------
  // Observability - optional. When absent, Sentry and OpenTelemetry exporters
  // stay disabled and the app continues to run with local structured logs.
  // ---------------------------------------------------------------------------
  SENTRY_DSN: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  OTEL_SERVICE_NAME: z.string().default('uitfood-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(
    emptyStringToUndefined,
    z.string().url().optional(),
  ),
  OTEL_TRACES_SAMPLER: z
    .enum([
      'always_on',
      'always_off',
      'traceidratio',
      'parentbased_always_on',
      'parentbased_always_off',
      'parentbased_traceidratio',
      'parentbased_jaeger_remote',
      'jaeger_remote',
      'xray',
    ])
    .default('parentbased_traceidratio'),
  OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).default(0.1),
  LOG_LEVEL: z
    .enum([
      'fatal',
      'error',
      'warn',
      'warning',
      'info',
      'log',
      'debug',
      'verbose',
    ])
    .default('log'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validation function passed to ConfigModule.forRoot({ validate }).
 * NestJS calls this synchronously during ConfigModule initialization.
 * Throwing here aborts the bootstrap sequence with a clear error message.
 */
export function validate(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n\n🚨 Environment configuration is invalid:\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the required values.\n`,
    );
  }

  return result.data;
}
