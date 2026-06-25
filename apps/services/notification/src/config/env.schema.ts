import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) =>
  value === '' ? undefined : value;

const stringToBoolean = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .default(defaultValue ? 'true' : 'false')
    .transform((value) =>
      ['1', 'true', 'yes'].includes(value.trim().toLowerCase()),
    );

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().optional(),
  NOTIFICATION_TCP_PORT: z.coerce.number().int().positive().default(4021),
  NOTIFICATION_MANAGEMENT_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(4022),

  REDIS_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  RABBITMQ_URL: z
    .string()
    .min(1, 'RABBITMQ_URL is required')
    .default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('uitfood.domain-events'),
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(10),

  IDENTITY_TCP_HOST: z.string().min(1).default('localhost'),
  IDENTITY_TCP_PORT: z.coerce.number().int().positive().default(4011),
  IDENTITY_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),

  INTERNAL_AUTH_JWT_SECRET: z
    .string()
    .min(32)
    .default('internal_auth_secret_for_local_dev_only_32_chars'),
  INTERNAL_AUTH_TRUSTED_ISSUERS: z.string().min(1).default('uitfood-gateway'),

  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173,http://localhost:5174'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: stringToBoolean(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().trim().optional(),
  SMTP_FROM: z.string().optional().default('noreply@soli.dev'),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function validate(config: Record<string, unknown>): Env {
  const result = schema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Notification environment is invalid: ${issues}`);
  }
  return result.data;
}
