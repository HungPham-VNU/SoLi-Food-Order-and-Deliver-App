import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Either the base Drizzle connection or a transaction handle. Lets outbox/inbox
 * helpers run inside a caller's transaction (transactional outbox) or
 * standalone, without leaking Drizzle's transaction generics everywhere.
 */
export type DrizzleExecutor =
  | NodePgDatabase
  | Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];
