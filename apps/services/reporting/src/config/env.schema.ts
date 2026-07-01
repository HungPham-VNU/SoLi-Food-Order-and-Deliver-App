import { z } from 'zod';

/**
 * Reporting service environment schema. Validated at startup (fail-fast).
 *
 * Reporting owns NO business tables — only read-optimized projection tables it
 * maintains from domain events (ordering.order.*, catalog.restaurant.changed).
 * It never queries another service's database, so the analytics queries run
 * entirely against its own projections.
 */
const schema = z.object({
  NODE_ENV: z.string().default('development'),

  // --- Database (Reporting owns its own projection database) ---
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Listeners ---
  PORT: z.coerce.number().int().positive().optional(),
  REPORTING_TCP_PORT: z.coerce.number().int().positive().default(4081),
  REPORTING_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4082),

  // --- RabbitMQ (inbound domain events that feed the projections) ---
  RABBITMQ_URL: z.string().min(1).default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('uitfood.domain-events'),
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(20),

  // --- Internal auth: verify inbound gateway JWTs on the analytics reads ---
  INTERNAL_AUTH_JWT_SECRET: z
    .string()
    .min(32)
    .default('internal_auth_secret_for_local_dev_only_32_chars'),
  INTERNAL_AUTH_TRUSTED_ISSUERS: z.string().default('uitfood-gateway'),
  INTERNAL_AUTH_JWT_ISSUER: z.string().min(1).default('uitfood-reporting'),
  INTERNAL_AUTH_JWT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(15)
    .max(300)
    .default(60),
});

export type Env = z.infer<typeof schema>;

export function validate(config: Record<string, unknown>): Env {
  const result = schema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Reporting environment is invalid: ${issues}`);
  }
  return result.data;
}
