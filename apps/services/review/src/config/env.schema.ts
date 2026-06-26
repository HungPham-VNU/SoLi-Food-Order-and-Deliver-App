import { z } from 'zod';

/**
 * Review service environment schema. Validated at startup (fail-fast).
 *
 * Review owns `reviews` and its transactional outbox. It calls Ordering's
 * temporary TCP review-eligibility read and publishes `review.submitted.v1`.
 */
const schema = z.object({
  NODE_ENV: z.string().default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  PORT: z.coerce.number().int().positive().optional(),
  REVIEW_TCP_PORT: z.coerce.number().int().positive().default(4061),
  REVIEW_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4062),

  ORDERING_TCP_HOST: z.string().min(1).default('localhost'),
  ORDERING_TCP_PORT: z.coerce.number().int().positive().default(4071),
  ORDERING_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),

  INTERNAL_AUTH_JWT_SECRET: z
    .string()
    .min(32)
    .default('internal_auth_secret_for_local_dev_only_32_chars'),
  INTERNAL_AUTH_TRUSTED_ISSUERS: z.string().default('uitfood-gateway'),
  INTERNAL_AUTH_JWT_ISSUER: z.string().min(1).default('uitfood-review'),
  INTERNAL_AUTH_JWT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(15)
    .max(300)
    .default(60),

  RABBITMQ_URL: z.string().min(1).default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('uitfood.domain-events'),
});

export type Env = z.infer<typeof schema>;

export function validate(config: Record<string, unknown>): Env {
  const result = schema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Review environment is invalid: ${issues}`);
  }
  return result.data;
}
