import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './src/drizzle/out',
  schema: [
    './src/notification/domain/*.schema.ts',
    './src/notification/acl/*.schema.ts',
    './src/messaging/schema/*.schema.ts',
  ],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
