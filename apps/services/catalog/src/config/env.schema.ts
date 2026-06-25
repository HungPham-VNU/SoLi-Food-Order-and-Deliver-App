import { z } from 'zod';

const stringToBoolean = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => ['1', 'true', 'yes'].includes(value.trim().toLowerCase()));

/**
 * Catalog service environment schema. Validated at startup (fail-fast).
 *
 * The Catalog DB owns restaurants, menus, modifiers, delivery zones, nutrition,
 * dietary tags, and the pgvector AI-search structures. RabbitMQ carries its
 * change events (producer) and inbound projections (e.g. review ratings).
 * Identity/Media are reached over internal TCP RPC.
 */
const schema = z.object({
  NODE_ENV: z.string().default('development'),

  // --- Database (Catalog owns its own database + pgvector) ---
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Listeners ---
  PORT: z.coerce.number().int().positive().optional(),
  CATALOG_TCP_PORT: z.coerce.number().int().positive().default(4031),
  CATALOG_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4032),

  // --- RabbitMQ (durable domain events) ---
  RABBITMQ_URL: z
    .string()
    .min(1)
    .default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('uitfood.domain-events'),
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(20),

  // --- Internal auth: verify inbound gateway JWTs on mutations ---
  INTERNAL_AUTH_JWT_SECRET: z
    .string()
    .min(32)
    .default('internal_auth_secret_for_local_dev_only_32_chars'),
  INTERNAL_AUTH_TRUSTED_ISSUERS: z
    .string()
    .default('uitfood-gateway,uitfood-api'),
  // ...and issue its own internal JWT when calling Identity/Media.
  INTERNAL_AUTH_JWT_ISSUER: z.string().min(1).default('uitfood-catalog'),
  INTERNAL_AUTH_JWT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(15)
    .max(300)
    .default(60),

  // --- Identity TCP RPC client (role promotion on restaurant approval) ---
  IDENTITY_TCP_HOST: z.string().min(1).default('localhost'),
  IDENTITY_TCP_PORT: z.coerce.number().int().positive().default(4011),
  IDENTITY_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  IDENTITY_RPC_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),

  // --- Media TCP RPC client (image metadata create + signatures) ---
  MEDIA_TCP_HOST: z.string().min(1).default('localhost'),
  MEDIA_TCP_PORT: z.coerce.number().int().positive().default(4001),
  MEDIA_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  MEDIA_RPC_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),

  // NOTE: AI-search / Ollama / embedding variables are added together with the
  // search module in the domain-extraction step (Phase 6 step 3).
  AI_SEARCH_ENABLED: stringToBoolean(false),
});

export type Env = z.infer<typeof schema>;

export function validate(config: Record<string, unknown>): Env {
  const result = schema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Catalog environment is invalid: ${issues}`);
  }
  return result.data;
}
