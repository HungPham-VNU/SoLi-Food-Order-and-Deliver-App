import type { ReviewRpcPattern } from '@uitfood/contracts';
import type { SessionAuthenticator } from '@/identity/identity.interfaces';

export interface ReviewRpcGateway {
  send<T = unknown>(pattern: ReviewRpcPattern, payload: unknown): Promise<T>;
}

export interface ReviewRouteOverrides {
  reviewClient?: ReviewRpcGateway;
  reviewSessionAuthenticator?: SessionAuthenticator;
}
