import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ReviewDatabase } from '@/drizzle/database.module';

export type DrizzleExecutor =
  | ReviewDatabase
  | Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];
