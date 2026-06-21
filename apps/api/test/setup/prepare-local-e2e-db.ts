import { spawnSync } from 'child_process';
import * as path from 'node:path';
import { inspect } from 'node:util';
import { Client } from 'pg';
import {
  API_ROOT,
  configureE2eEnvironment,
  getDatabaseName,
  isCiEnvironment,
  isLocalDatabaseUrl,
  redactDatabaseUrl,
  withDatabaseName,
} from './e2e-env';

async function main(): Promise<void> {
  if (isCiEnvironment()) {
    console.log('[e2e-db] CI detected; skipping local E2E database setup.');
    return;
  }

  const { databaseUrl, source } = configureE2eEnvironment();
  console.log(`[e2e-db] Using ${source}: ${redactDatabaseUrl(databaseUrl)}`);

  await recreateLocalTestDatabase(databaseUrl);
  await ensureSearchExtensions(databaseUrl);
  runDrizzlePush(databaseUrl);
  await ensureSearchExtensions(databaseUrl);
}

async function recreateLocalTestDatabase(databaseUrl: string): Promise<void> {
  if (!isLocalDatabaseUrl(databaseUrl)) {
    throw new Error(
      'Refusing to recreate a non-local E2E database outside CI.',
    );
  }

  const databaseName = getDatabaseName(databaseUrl);
  const maintenanceUrl = withDatabaseName(databaseUrl, 'postgres');
  const client = new Client({ connectionString: maintenanceUrl });

  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await client.query(
      `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`,
    );
    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`[e2e-db] Recreated database "${databaseName}".`);
  } finally {
    await client.end();
  }
}

function runDrizzlePush(databaseUrl: string): void {
  const drizzleKitCli = path.join(
    API_ROOT,
    'node_modules',
    'drizzle-kit',
    'bin.cjs',
  );
  const commonOptions = {
    cwd: API_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      TEST_DATABASE_URL: databaseUrl,
      NODE_ENV: 'test',
    },
    stdio: 'inherit',
  } as const;
  const result = spawnSync(
    process.execPath,
    [drizzleKitCli, 'push', '--force'],
    commonOptions,
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `drizzle-kit push --force failed with exit code ${result.status}`,
    );
  }
}

async function ensureSearchExtensions(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    await client.query(
      'CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public',
    );
    await client.query(
      'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public',
    );
    await client.query(
      'CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public',
    );
    console.log('[e2e-db] Search extensions are ready.');
  } finally {
    await client.end();
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

main().catch((error) => {
  const details =
    error instanceof Error && error.message
      ? error.stack || error.message
      : inspect(error, { depth: 5 });
  console.error(`[e2e-db] Failed to prepare local E2E database: ${details}`);
  process.exit(1);
});
