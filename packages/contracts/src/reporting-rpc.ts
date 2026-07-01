import { z } from 'zod';

/**
 * Reporting service synchronous TCP RPC contracts (Phase 10).
 *
 * The gateway translates the admin analytics HTTP routes into these patterns.
 * The read carries `internalAuth` — the gateway-issued internal JWT with
 * `aud=reporting`; Reporting re-checks the admin role.
 */
export const REPORTING_RPC_PATTERNS = {
  getPlatformAnalytics: 'reporting.analytics.platform.v1',
  getRestaurantAnalytics: 'reporting.analytics.restaurant.v1',
} as const;

export type ReportingRpcPattern =
  (typeof REPORTING_RPC_PATTERNS)[keyof typeof REPORTING_RPC_PATTERNS];

/** Stable RPC error envelope translated back to HTTP status at the gateway. */
export const reportingRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
});
export type ReportingRpcError = z.infer<typeof reportingRpcErrorSchema>;

export const platformAnalyticsRequestSchema = z.object({
  internalAuth: z.string().min(1),
  range: z
    .enum(['today', 'yesterday', '7d', '30d'])
    .optional()
    .default('today'),
});
export type PlatformAnalyticsRequest = z.infer<
  typeof platformAnalyticsRequestSchema
>;

export const restaurantAnalyticsRequestSchema =
  platformAnalyticsRequestSchema.extend({
    restaurantId: z.string().uuid(),
  });
export type RestaurantAnalyticsRequest = z.infer<
  typeof restaurantAnalyticsRequestSchema
>;
