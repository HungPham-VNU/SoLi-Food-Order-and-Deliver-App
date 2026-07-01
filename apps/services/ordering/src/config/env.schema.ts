import { z } from 'zod';

const stringToBoolean = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .default(defaultValue ? 'true' : 'false')
    .transform((value) =>
      ['1', 'true', 'yes'].includes(value.trim().toLowerCase()),
    );

/**
 * Ordering service environment schema. Validated at startup (fail-fast).
 *
 * Ordering owns carts (Redis), orders, order items, status logs, app settings,
 * and the Catalog snapshot ACL tables. It drives the checkout saga over TCP to
 * Promotion + Payment, consumes Catalog/Payment events over RabbitMQ, and
 * publishes its own ordering.* events through the outbox.
 */
const schema = z.object({
  NODE_ENV: z.string().default('development'),

  // --- Database (Ordering owns its own database) ---
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Redis (cart + checkout idempotency/locks) ---
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  // --- Listeners ---
  PORT: z.coerce.number().int().positive().optional(),
  ORDERING_TCP_PORT: z.coerce.number().int().positive().default(4071),
  ORDERING_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4072),

  // --- RabbitMQ (durable domain events: Catalog snapshots in, ordering events out) ---
  RABBITMQ_URL: z.string().min(1).default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('uitfood.domain-events'),
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(20),

  // --- Internal auth ---
  INTERNAL_AUTH_JWT_SECRET: z
    .string()
    .min(32)
    .default('internal_auth_secret_for_local_dev_only_32_chars'),
  INTERNAL_AUTH_TRUSTED_ISSUERS: z
    .string()
    .default('uitfood-gateway'),
  INTERNAL_AUTH_JWT_ISSUER: z.string().min(1).default('uitfood-ordering'),
  INTERNAL_AUTH_JWT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(15)
    .max(300)
    .default(60),

  // --- Identity TCP RPC client (customer contact data for order detail) ---
  IDENTITY_TCP_HOST: z.string().min(1).default('localhost'),
  IDENTITY_TCP_PORT: z.coerce.number().int().positive().default(4011),
  IDENTITY_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  IDENTITY_RPC_REQUIRED: stringToBoolean(false),

  // --- Promotion TCP RPC client (checkout saga: reserve/confirm/rollback) ---
  PROMOTION_TCP_HOST: z.string().min(1).default('localhost'),
  PROMOTION_TCP_PORT: z.coerce.number().int().positive().default(4041),
  PROMOTION_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  PROMOTION_RPC_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),
  PROMOTION_RPC_REQUIRED: stringToBoolean(false),

  // --- Payment TCP RPC client (checkout saga: create-attempt/mark-failed) ---
  PAYMENT_TCP_HOST: z.string().min(1).default('localhost'),
  PAYMENT_TCP_PORT: z.coerce.number().int().positive().default(4051),
  PAYMENT_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  PAYMENT_RPC_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),
  PAYMENT_RPC_REQUIRED: stringToBoolean(false),
});

export type Env = z.infer<typeof schema>;

export function validate(config: Record<string, unknown>): Env {
  const result = schema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Ordering environment is invalid: ${issues}`);
  }
  return result.data;
}
