import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const baseUrl = process.env.DATABASE_URL!;

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'host.docker.internal',
  'postgres',
]);

function isLocalDatabase(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

const dbUrl = isLocalDatabase(baseUrl)
  ? baseUrl
  : baseUrl.includes('?')
    ? `${baseUrl}&sslmode=require`
    : `${baseUrl}?sslmode=require`;

export default defineConfig({
  out: './src/drizzle/out',
  schema: './src/drizzle/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl,
  },
});
