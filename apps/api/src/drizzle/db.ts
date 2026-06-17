import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  getNodePostgresSslConfig,
  requireDatabaseUrl,
} from './postgres-connection';

const databaseUrl = requireDatabaseUrl();

export const db = drizzle({
  connection: {
    connectionString: databaseUrl,
    ssl: getNodePostgresSslConfig(databaseUrl),
  },
});
