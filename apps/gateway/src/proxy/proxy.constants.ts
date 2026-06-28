/**
 * Gateway proxy constants.
 */

/** Correlation header propagated to services and echoed to clients. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Paths served by the gateway itself rather than service route controllers.
 */
export const GATEWAY_MANAGEMENT_PATHS = ['/live', '/ready', '/metrics'] as const;

/**
 * Inbound headers stripped at the edge before forwarding. A client must never
 * be able to assert internal identity/trust or the dev test-user bypass; those
 * are minted only inside the trust boundary (future phases) and the test-user
 * header is dev/test-only (Phase 0).
 */
export const STRIPPED_INBOUND_HEADERS = [
  'x-test-user-id',
  'x-internal-jwt',
  'x-internal-user',
  'x-gateway-authenticated',
] as const;
