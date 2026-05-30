import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from './drizzle.constants';
import { DrizzleBootstrap } from './drizzle.bootstrap';

/**
 * Local Postgres (Docker, bare-metal dev) typically has SSL disabled, and
 * node-postgres throws `The server does not support SSL connections` when SSL
 * is forced against such a server. Remote managed Postgres (e.g. Render) does
 * require SSL. Decide based on the host so the same code works in both places
 * without weakening production: SSL stays enabled for every non-local host.
 */
function shouldUseSsl(databaseUrl: string): boolean {
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    // Unparseable URL — fail safe by keeping SSL on.
    return true;
  }
  const localHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'host.docker.internal',
    'postgres',
  ]);
  return !localHosts.has(host);
}

@Module({
  providers: [
    {
      provide: DB_CONNECTION,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is not defined');
        }
        return drizzle({
          connection: {
            connectionString: databaseUrl,
            ssl: shouldUseSsl(databaseUrl),
          },
        });
      },
    },
    DrizzleBootstrap,
  ],
  exports: [DB_CONNECTION],
})
export class DatabaseModule {}
