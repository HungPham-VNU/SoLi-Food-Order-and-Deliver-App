const LOCAL_DATABASE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'host.docker.internal',
  'postgres',
]);

export function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    return LOCAL_DATABASE_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

export function withRequiredSslMode(databaseUrl: string): string {
  const trimmedUrl = databaseUrl.trim();
  if (!trimmedUrl || isLocalDatabaseUrl(trimmedUrl)) return trimmedUrl;
  if (/[?&]sslmode=/.test(trimmedUrl)) return trimmedUrl;

  return trimmedUrl.includes('?')
    ? `${trimmedUrl}&sslmode=require`
    : `${trimmedUrl}?sslmode=require`;
}

export function getNodePostgresSslConfig(
  databaseUrl: string,
): false | { rejectUnauthorized: boolean } {
  if (isLocalDatabaseUrl(databaseUrl)) return false;

  // Managed Postgres providers commonly require encrypted connections while
  // using CA chains not available in Node's built-in trust store.
  return { rejectUnauthorized: false };
}

export function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }
  return databaseUrl;
}
