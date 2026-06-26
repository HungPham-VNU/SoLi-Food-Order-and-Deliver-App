import type { OrderingRpcPattern } from '@uitfood/contracts';
import type { SessionAuthenticator } from '@/identity/identity.interfaces';

/**
 * Thin gateway-side Ordering RPC client. A single generic `send` keeps the
 * ~22-pattern surface manageable; the HTTP controllers build the typed payload
 * and pick the pattern from ORDERING_RPC_PATTERNS.
 */
export interface OrderingRpcGateway {
  send<T = unknown>(pattern: OrderingRpcPattern, payload: unknown): Promise<T>;
}

export interface OrderingRouteOverrides {
  orderingClient?: OrderingRpcGateway;
  orderingSessionAuthenticator?: SessionAuthenticator;
}
