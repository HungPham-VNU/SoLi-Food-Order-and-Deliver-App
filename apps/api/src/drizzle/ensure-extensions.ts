import 'dotenv/config';
import { Client } from 'pg';

const REQUIRED_EXTENSIONS = ['unaccent', 'pg_trgm', 'vector'] as const;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required before preparing PostgreSQL extensions.',
    );
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: getSslConfig(databaseUrl),
  });

  await client.connect();
  try {
    for (const extension of REQUIRED_EXTENSIONS) {
      await client.query(
        `CREATE EXTENSION IF NOT EXISTS ${quoteIdentifier(extension)} WITH SCHEMA public`,
      );
    }

    const result = await client.query<{ extname: string }>(
      'SELECT extname FROM pg_extension WHERE extname = ANY($1::text[])',
      [REQUIRED_EXTENSIONS],
    );
    const present = new Set(result.rows.map((row) => row.extname));
    const missing = REQUIRED_EXTENSIONS.filter((name) => !present.has(name));

    if (missing.length > 0) {
      throw new Error(
        `PostgreSQL extension(s) are still missing after creation: ${missing.join(', ')}`,
      );
    }

    console.log(`[db:extensions] Ready: ${REQUIRED_EXTENSIONS.join(', ')}`);
  } catch (error) {
    printExtensionHint(error);
    throw error;
  } finally {
    await client.end();
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function getSslConfig(
  databaseUrl: string,
): false | { rejectUnauthorized: boolean } {
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
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

function printExtensionHint(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('extension "vector" is not available') ||
    message.includes('could not open extension control file')
  ) {
    console.error(
      [
        '[db:extensions] The connected PostgreSQL server does not have pgvector installed.',
        '[db:extensions] For local Docker, use the pgvector image and recreate the postgres service:',
        '[db:extensions] docker compose -f docker-compose.dev.yml up -d --force-recreate postgres',
      ].join('\n'),
    );
    return;
  }

  if (message.includes('permission denied to create extension')) {
    console.error(
      [
        '[db:extensions] The database user cannot create required extensions.',
        '[db:extensions] Run CREATE EXTENSION as a privileged database user, then retry db:push.',
      ].join('\n'),
    );
  }
}

main().catch((error) => {
  console.error(
    `[db:extensions] Failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
});
