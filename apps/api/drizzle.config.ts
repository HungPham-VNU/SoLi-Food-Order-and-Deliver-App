import { defineConfig } from 'drizzle-kit';
import { withRequiredSslMode } from './src/drizzle/postgres-connection';

const baseUrl = process.env.DATABASE_URL!;
const dbUrl = withRequiredSslMode(baseUrl);

export default defineConfig({
  out: './src/drizzle/out',
  schema: './src/drizzle/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl,
  },
});
