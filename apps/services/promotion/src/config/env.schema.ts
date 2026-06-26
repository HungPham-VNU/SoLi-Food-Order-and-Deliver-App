import { z } from 'zod';

/**
 * Promotion service environment schema. Validated at startup (fail-fast).
 *
 * The Promotion DB owns promotions, coupon codes, and the promotion_usages
 * reservation ledger. The service is request/response only (no RabbitMQ in this
 * wave): Ordering drives the discount lifecycle over internal TCP RPC and the
 * gateway exposes the public read/preview endpoints.
 */
const schema = z.object({
  NODE_ENV: z.string().default('development'),

  // --- Database (Promotion owns its own database) ---
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Listeners ---
  PORT: z.coerce.number().int().positive().optional(),
  PROMOTION_TCP_PORT: z.coerce.number().int().positive().default(4041),
  PROMOTION_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4042),

  // --- Internal auth: verify inbound gateway/api JWTs on the discount lifecycle ---
  INTERNAL_AUTH_JWT_SECRET: z
    .string()
    .min(32)
    .default('internal_auth_secret_for_local_dev_only_32_chars'),
  INTERNAL_AUTH_TRUSTED_ISSUERS: z
    .string()
    // uitfood-ordering: the extracted Ordering service signs the checkout-saga
    // reserve/confirm/rollback service tokens with this issuer.
    .default('uitfood-gateway,uitfood-api,uitfood-ordering'),
  INTERNAL_AUTH_JWT_ISSUER: z.string().min(1).default('uitfood-promotion'),
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
    throw new Error(`Promotion environment is invalid: ${issues}`);
  }
  return result.data;
}
