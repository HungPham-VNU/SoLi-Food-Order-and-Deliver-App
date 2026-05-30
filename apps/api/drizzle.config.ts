import { defineConfig } from 'drizzle-kit';

import 'dotenv/config';

export default defineConfig({
  out: './src/drizzle/out',
  schema: './src/drizzle/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://food_order:foodordersecret@localhost:5432/food_order_db'
  }
});