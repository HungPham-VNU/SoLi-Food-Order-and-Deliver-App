import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

export const API_ROOT = findApiRoot(process.cwd());
export const DEFAULT_LOCAL_DATABASE_URL =
  'postgresql://food_order:foodordersecret@localhost:5432/food_order_db';

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'host.docker.internal',
  'postgres',
]);

const TEST_DATABASE_NAME_PATTERN = /(^|[_-])(test|e2e)([_-]|$)/i;

export type E2eDatabaseConfig = {
  databaseUrl: string;
  isCi: boolean;
  source: 'TEST_DATABASE_URL' | 'DATABASE_URL' | 'derived-local-default';
};

export function loadE2eEnv(apiRoot = API_ROOT): string[] {
  const loaded: string[] = [];
  for (const fileName of ['.env', '.env.test', '.env.test.local']) {
    const filePath = path.join(apiRoot, fileName);
    if (!fs.existsSync(filePath)) continue;

    dotenv.config({ path: filePath, override: true, quiet: true });
    loaded.push(fileName);
  }
  return loaded;
}

export function configureE2eEnvironment(): E2eDatabaseConfig {
  loadE2eEnv();

  const isCi = isCiEnvironment();
  const explicitTestUrl = normalizeEnvValue(process.env.TEST_DATABASE_URL);
  const configuredDatabaseUrl = normalizeEnvValue(process.env.DATABASE_URL);

  if (explicitTestUrl) {
    if (!isCi) {
      assertLocalTestDatabaseUrl(explicitTestUrl, configuredDatabaseUrl);
    }
    applyDatabaseUrl(explicitTestUrl);
    return {
      databaseUrl: explicitTestUrl,
      isCi,
      source: 'TEST_DATABASE_URL',
    };
  }

  if (isCi) {
    if (!configuredDatabaseUrl) {
      throw new Error(
        'DATABASE_URL is required before running E2E tests in CI.',
      );
    }
    process.env.DATABASE_URL = configuredDatabaseUrl;
    return {
      databaseUrl: configuredDatabaseUrl,
      isCi,
      source: 'DATABASE_URL',
    };
  }

  if (
    configuredDatabaseUrl &&
    isTestDatabaseName(getDatabaseName(configuredDatabaseUrl))
  ) {
    applyDatabaseUrl(configuredDatabaseUrl);
    return {
      databaseUrl: configuredDatabaseUrl,
      isCi,
      source: 'DATABASE_URL',
    };
  }

  const localBaseUrl = configuredDatabaseUrl ?? DEFAULT_LOCAL_DATABASE_URL;
  if (!isLocalDatabaseUrl(localBaseUrl)) {
    throw new Error(
      [
        'Refusing to derive a local E2E database from a non-local DATABASE_URL.',
        'Set TEST_DATABASE_URL to a dedicated test database instead.',
      ].join(' '),
    );
  }

  const derivedTestUrl = deriveLocalTestDatabaseUrl(localBaseUrl);
  assertLocalTestDatabaseUrl(derivedTestUrl, localBaseUrl);
  applyDatabaseUrl(derivedTestUrl);

  return {
    databaseUrl: derivedTestUrl,
    isCi,
    source: 'derived-local-default',
  };
}

export function isCiEnvironment(): boolean {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

export function deriveLocalTestDatabaseUrl(databaseUrl: string): string {
  const databaseName = getDatabaseName(databaseUrl);
  return withDatabaseName(databaseUrl, toLocalTestDatabaseName(databaseName));
}

export function getDatabaseName(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName) {
    throw new Error(`Database URL is missing a database name: ${databaseUrl}`);
  }
  return databaseName;
}

export function withDatabaseName(databaseUrl: string, databaseName: string) {
  const url = new URL(databaseUrl);
  url.pathname = `/${encodeURIComponent(databaseName)}`;
  return url.toString();
}

export function isLocalDatabaseUrl(databaseUrl: string): boolean {
  return LOCAL_HOSTS.has(new URL(databaseUrl).hostname);
}

export function redactDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (url.password) url.password = '***';
  return url.toString();
}

function applyDatabaseUrl(databaseUrl: string): void {
  process.env.TEST_DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV ??= 'test';
}

function assertLocalTestDatabaseUrl(
  testDatabaseUrl: string,
  baseDatabaseUrl?: string,
): void {
  const testDatabaseName = getDatabaseName(testDatabaseUrl);
  if (!isTestDatabaseName(testDatabaseName)) {
    throw new Error(
      [
        `Refusing to run local E2E tests against "${testDatabaseName}".`,
        'The database name must include "test" or "e2e".',
      ].join(' '),
    );
  }

  if (
    baseDatabaseUrl &&
    urlsPointToSameDatabase(testDatabaseUrl, baseDatabaseUrl) &&
    !isTestDatabaseName(getDatabaseName(baseDatabaseUrl))
  ) {
    throw new Error(
      [
        'Refusing to run local E2E tests because TEST_DATABASE_URL matches DATABASE_URL.',
        'Use a dedicated test database so local development data is not reset.',
      ].join(' '),
    );
  }
}

function toLocalTestDatabaseName(databaseName: string): string {
  if (isTestDatabaseName(databaseName)) return databaseName;
  if (databaseName === 'food_order_db') return 'food_order_test';
  if (databaseName.endsWith('_db')) {
    return `${databaseName.slice(0, -3)}_test`;
  }
  if (databaseName.endsWith('-db')) {
    return `${databaseName.slice(0, -3)}-test`;
  }
  if (databaseName.endsWith('_dev')) {
    return `${databaseName.slice(0, -4)}_test`;
  }
  if (databaseName.endsWith('-dev')) {
    return `${databaseName.slice(0, -4)}-test`;
  }
  return `${databaseName}_test`;
}

function isTestDatabaseName(databaseName: string): boolean {
  return TEST_DATABASE_NAME_PATTERN.test(databaseName);
}

function urlsPointToSameDatabase(left: string, right: string): boolean {
  const leftUrl = new URL(left);
  const rightUrl = new URL(right);
  return (
    leftUrl.protocol === rightUrl.protocol &&
    leftUrl.username === rightUrl.username &&
    leftUrl.hostname === rightUrl.hostname &&
    leftUrl.port === rightUrl.port &&
    getDatabaseName(left) === getDatabaseName(right)
  );
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function findApiRoot(startDir: string): string {
  let current = path.resolve(startDir);

  for (let depth = 0; depth < 8; depth += 1) {
    const packageJsonPath = path.join(current, 'package.json');
    const jestConfigPath = path.join(current, 'test', 'jest-e2e.json');
    if (fs.existsSync(packageJsonPath) && fs.existsSync(jestConfigPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.resolve(startDir, 'apps/api');
}
