import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from './drizzle.constants';
import { DrizzleBootstrap } from './drizzle.bootstrap';

/**
 * Local Postgres (Docker, bare-metal dev) typically has SSL disabled, and
 * node-postgres throws `The server does not support SSL connections` when SSL
 * is forced against such a server. Remote managed Postgres (e.g. Render) does
 * require SSL. Decide based on the host so the same code works in both places.
 *
 * `rejectUnauthorized: false` is intentional for non-local hosts: managed cloud
 * Postgres providers (Render, Supabase, Railway, etc.) commonly use certificates
 * signed by intermediate CAs that are not in Node.js's built-in trust store,
 * causing `ssl: true` to fail with a certificate-verification error even though
 * the connection is encrypted. The network path to these hosts is trusted at the
 * platform level, so skipping cert verification is acceptable in practice.
 */
function getSslConfig(
  databaseUrl: string,
): false | { rejectUnauthorized: boolean } {
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    // Unparseable URL — fail safe by enabling SSL without cert verification.
    return { rejectUnauthorized: false };
  }
  const localHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'host.docker.internal',
    'postgres',
  ]);
  if (localHosts.has(host)) return false;
  return { rejectUnauthorized: false };
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
            ssl: getSslConfig(databaseUrl),
          },
        });
      },
    },
    DrizzleBootstrap,
  ],
  exports: [DB_CONNECTION],
})
export class DatabaseModule {}
