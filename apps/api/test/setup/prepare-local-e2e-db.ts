import { spawnSync } from 'child_process';
import { Client } from 'pg';
import {
  API_ROOT,
  configureE2eEnvironment,
  getDatabaseName,
  isCiEnvironment,
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

  await ensureDatabaseExists(databaseUrl);
  await ensureSearchExtensions(databaseUrl);
  runDrizzlePush(databaseUrl);
  await ensureSearchExtensions(databaseUrl);
}

async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const databaseName = getDatabaseName(databaseUrl);
  const maintenanceUrl = withDatabaseName(databaseUrl, 'postgres');
  const client = new Client({ connectionString: maintenanceUrl });

  await client.connect();
  try {
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );

    if ((result.rowCount ?? 0) > 0) {
      console.log(`[e2e-db] Database "${databaseName}" already exists.`);
      return;
    }

    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`[e2e-db] Created database "${databaseName}".`);
  } finally {
    await client.end();
  }
}

function runDrizzlePush(databaseUrl: string): void {
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
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
  const result =
    process.platform === 'win32'
      ? spawnSync('pnpm run db:push', {
          ...commonOptions,
          shell: true,
        })
      : spawnSync(pnpm, ['run', 'db:push'], commonOptions);

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`drizzle-kit push failed with exit code ${result.status}`);
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
  console.error(
    `[e2e-db] Failed to prepare local E2E database: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
});
