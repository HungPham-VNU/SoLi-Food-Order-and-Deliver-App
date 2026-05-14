import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://food_order:foodordersecret@localhost:5432/food_order_db' });
async function run() {
  await client.connect();
  try {
    await client.query('ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_amount" integer NOT NULL DEFAULT 0');
    console.log('Migration 0013 applied: discount_amount column added to orders');
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
run();
