/**
 * Opaque transaction carrier used to coordinate atomic work without exposing
 * another context's tables or repository implementation.
 */
export interface UnitOfWorkContext {
  readonly transaction: unknown;
}
