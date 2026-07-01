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
    .default('uitfood-gateway'),
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
  IDENTITY_RPC_REQUIRED: stringToBoolean(false),

  // --- Media TCP RPC client (image metadata create + signatures) ---
  MEDIA_TCP_HOST: z.string().min(1).default('localhost'),
  MEDIA_TCP_PORT: z.coerce.number().int().positive().default(4001),
  MEDIA_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  MEDIA_RPC_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),
  MEDIA_RPC_REQUIRED: stringToBoolean(false),

  // --- AI (Ollama) + embedding indexing (the search write path) ---
  OLLAMA_BASE_URL: z.string().trim().url().default('https://ollama.com'),
  OLLAMA_MODEL: z.string().trim().min(1).default('gpt-oss:20b'),
  OLLAMA_API_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().default(''),
  ),
  HUGGINGFACE_API_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().optional(),
  ),
  AI_SEARCH_ENABLED: stringToBoolean(false),
  AI_SEARCH_MODEL: z.string().trim().min(1).default('gpt-oss:20b'),
  AI_SEARCH_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  AI_SEARCH_VERIFICATION_ENABLED: stringToBoolean(true),
  AI_SEARCH_VERIFICATION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(30_000)
    .default(5000),
  AI_SEARCH_VERIFICATION_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(5)
    .max(50)
    .default(40),
  AI_SEARCH_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.65),
  AI_SEARCH_DAILY_LIMIT_PER_USER: z.coerce
    .number()
    .int()
    .positive()
    .default(100),
  AI_SEARCH_RANKING_V2_ENABLED: stringToBoolean(false),
  AI_SEARCH_DIVERSITY_ENABLED: stringToBoolean(true),
  AI_SEARCH_MAX_ITEMS_PER_RESTAURANT: z.coerce
    .number()
    .int()
    .positive()
    .default(3),
  AI_SEARCH_RANKING_WEIGHTS: z
    .string()
    .trim()
    .min(1)
    .default(
      '{"retrieval":0.35,"nutrition":0.15,"price":0.1,"distance":0.1,"rating":0.1,"popularity":0.1,"freshness":0.05,"availability":0.05}',
    ),
  AI_SEARCH_EMBEDDING_PROVIDER: z
    .enum(['ollama', 'huggingface'])
    .default('ollama'),
  AI_SEARCH_EMBEDDING_BASE_URL: z
    .string()
    .trim()
    .url()
    .default('http://localhost:11434'),
  AI_SEARCH_EMBEDDING_MODEL: z.string().trim().min(1).default('embeddinggemma'),
  AI_SEARCH_EMBEDDING_VERSION: z.string().trim().min(1).default('1'),
  AI_SEARCH_EMBEDDING_DIMENSIONS: z.coerce
    .number()
    .int()
    .positive()
    .default(768),
  AI_SEARCH_EMBEDDING_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(8000),
  AI_SEARCH_EMBEDDING_WORKER_ENABLED: stringToBoolean(false),
  AI_SEARCH_EMBEDDING_BATCH_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(20),
  AI_SEARCH_EMBEDDING_RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
}).superRefine((env, ctx) => {
  if (
    env.AI_SEARCH_EMBEDDING_PROVIDER === 'huggingface' &&
    !env.HUGGINGFACE_API_KEY
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['HUGGINGFACE_API_KEY'],
      message:
        'HUGGINGFACE_API_KEY is required when AI_SEARCH_EMBEDDING_PROVIDER is huggingface',
    });
  }

  if (
    env.AI_SEARCH_EMBEDDING_PROVIDER === 'huggingface' &&
    env.AI_SEARCH_EMBEDDING_MODEL === 'embeddinggemma'
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['AI_SEARCH_EMBEDDING_MODEL'],
      message:
        'AI_SEARCH_EMBEDDING_MODEL must be explicitly set to a valid Hugging Face model when using the huggingface provider. The default "embeddinggemma" is for Ollama only.',
    });
  }
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
