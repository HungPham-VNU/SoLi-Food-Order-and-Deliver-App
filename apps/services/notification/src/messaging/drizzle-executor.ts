import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type DrizzleExecutor =
  | NodePgDatabase
  | Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];
