import type { CatalogRpcPattern } from '@uitfood/contracts';
import type { SessionAuthenticator } from '@/identity/identity.interfaces';

/**
 * Thin gateway-side Catalog RPC client. A single generic `send` keeps the
 * ~37-pattern surface manageable; the HTTP controllers build the typed payload
 * and pick the pattern from CATALOG_RPC_PATTERNS.
 */
import { Observable } from 'rxjs';

export interface CatalogRpcGateway {
  send<T = unknown>(pattern: CatalogRpcPattern, payload: unknown): Promise<T>;
  stream<T = unknown>(pattern: CatalogRpcPattern, payload: unknown): Observable<T>;
}

export interface CatalogRouteOverrides {
  catalogClient?: CatalogRpcGateway;
  catalogSessionAuthenticator?: SessionAuthenticator;
}
