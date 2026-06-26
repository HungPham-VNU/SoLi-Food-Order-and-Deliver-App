import { z } from 'zod';

/**
 * Gateway environment schema. Validated at startup via
 * ConfigModule.forRoot({ validate }) so the process fails fast on misconfig.
 *
 * The gateway is deliberately thin: it needs only where to listen and where to
 * forward. No business secrets live here — those stay in the monolith (and,
 * later, in each service's own scoped secret group).
 */
const schema = z.object({
  NODE_ENV: z.string().default('development'),

  /** Public port the gateway listens on. */
  PORT: z.coerce.number().int().positive().default(8080),

  /** Base URL of the upstream monolith that all /api/** traffic proxies to. */
  MONOLITH_UPSTREAM_URL: z
    .string()
    .url(
      'MONOLITH_UPSTREAM_URL must be a valid URL (e.g. http://localhost:3000)',
    )
    .default('http://localhost:3000'),

  /**
   * End-to-end proxy timeout in milliseconds applied to both the incoming
   * socket and the upstream request. Bounds a slow/hung monolith.
   */
  GATEWAY_PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  /** Phase 3 cutover switch. False keeps all Media routes on the monolith. */
  MEDIA_ROUTES_ENABLED: z
    .string()
    .default('false')
    .transform((value) => ['1', 'true', 'yes'].includes(value.toLowerCase())),
  MEDIA_TCP_HOST: z.string().min(1).default('localhost'),
  MEDIA_TCP_PORT: z.coerce.number().int().positive().default(4001),
  MEDIA_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4002),
  MEDIA_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  /** Phase 4 cutover switch. False keeps Better Auth routes on the monolith. */
  IDENTITY_ROUTES_ENABLED: z
    .string()
    .default('false')
    .transform((value) => ['1', 'true', 'yes'].includes(value.toLowerCase())),
  IDENTITY_TCP_HOST: z.string().min(1).default('localhost'),
  IDENTITY_TCP_PORT: z.coerce.number().int().positive().default(4011),
  IDENTITY_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4012),
  IDENTITY_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  GATEWAY_AUTH_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  /** Phase 5 cutover switch. False keeps Notification routes/sockets on the monolith. */
  NOTIFICATION_ROUTES_ENABLED: z
    .string()
    .default('false')
    .transform((value) => ['1', 'true', 'yes'].includes(value.toLowerCase())),
  NOTIFICATION_TCP_HOST: z.string().min(1).default('localhost'),
  NOTIFICATION_TCP_PORT: z.coerce.number().int().positive().default(4021),
  NOTIFICATION_MANAGEMENT_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(4022),
  NOTIFICATION_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  /** Phase 6 cutover switch. False keeps all Catalog routes on the monolith. */
  CATALOG_ROUTES_ENABLED: z
    .string()
    .default('false')
    .transform((value) => ['1', 'true', 'yes'].includes(value.toLowerCase())),
  CATALOG_TCP_HOST: z.string().min(1).default('localhost'),
  CATALOG_TCP_PORT: z.coerce.number().int().positive().default(4031),
  CATALOG_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4032),
  CATALOG_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  /** Phase 7 cutover switch. False keeps all Promotion routes on the monolith. */
  PROMOTION_ROUTES_ENABLED: z
    .string()
    .default('false')
    .transform((value) => ['1', 'true', 'yes'].includes(value.toLowerCase())),
  PROMOTION_TCP_HOST: z.string().min(1).default('localhost'),
  PROMOTION_TCP_PORT: z.coerce.number().int().positive().default(4041),
  PROMOTION_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4042),
  PROMOTION_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  /** Phase 7 cutover switch. False keeps Payment-owned routes on the monolith. */
  PAYMENT_ROUTES_ENABLED: z
    .string()
    .default('false')
    .transform((value) => ['1', 'true', 'yes'].includes(value.toLowerCase())),
  PAYMENT_TCP_HOST: z.string().min(1).default('localhost'),
  PAYMENT_TCP_PORT: z.coerce.number().int().positive().default(4051),
  PAYMENT_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4052),
  PAYMENT_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  /** Phase 8 cutover switch. False keeps Review-owned routes on the monolith. */
  REVIEW_ROUTES_ENABLED: z
    .string()
    .default('false')
    .transform((value) => ['1', 'true', 'yes'].includes(value.toLowerCase())),
  REVIEW_TCP_HOST: z.string().min(1).default('localhost'),
  REVIEW_TCP_PORT: z.coerce.number().int().positive().default(4061),
  REVIEW_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4062),
  REVIEW_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  GATEWAY_CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:5174'),
  INTERNAL_AUTH_JWT_SECRET: z
    .string()
    .min(32)
    .default('internal_auth_secret_for_local_dev_only_32_chars'),
  INTERNAL_AUTH_JWT_ISSUER: z.string().min(1).default('uitfood-gateway'),
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
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`\n\n🚨 Gateway environment is invalid:\n${issues}\n`);
  }
  return result.data;
}
