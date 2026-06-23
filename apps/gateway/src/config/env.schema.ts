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
    .url('MONOLITH_UPSTREAM_URL must be a valid URL (e.g. http://localhost:3000)')
    .default('http://localhost:3000'),

  /**
   * End-to-end proxy timeout in milliseconds applied to both the incoming
   * socket and the upstream request. Bounds a slow/hung monolith.
   */
  GATEWAY_PROXY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30_000),
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
