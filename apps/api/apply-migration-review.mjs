/**
 * UC-22 Review BC migration — applies all schema changes for the Review BC:
 *
 *  1. ALTER TYPE notification_type ADD VALUE 'new_review' (outside tx)
 *  2. CREATE TYPE review_moderation_status (visible | flagged | hidden)
 *  3. CREATE TABLE reviews + indices + unique + check
 *  4. ALTER TABLE restaurants ADD COLUMN average_rating / rating_sum / review_count
 *
 * Step 1 must run OUTSIDE a transaction (PostgreSQL limitation on enum-value
 * additions). Steps 2–4 run inside a single transaction so the schema either
 * fully advances or fully rolls back.
 *
 * Idempotent: re-running this script is safe.
 *
 * Usage:
 *   node apps/api/apply-migration-review.mjs
 */
import pg from 'pg';

const { Client } = pg;

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://food_order:foodordersecret@localhost:5432/food_order_db';

const client = new Client({ connectionString });

async function run() {
  await client.connect();
  try {
    // -------------------------------------------------------------------------
    // 1. notification_type enum value (cannot be inside a transaction)
    // -------------------------------------------------------------------------
    await client.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_review' AFTER 'new_order_received'`,
    );
    console.log("Added 'new_review' to notification_type enum.");

    // -------------------------------------------------------------------------
    // 2. review_moderation_status enum
    // -------------------------------------------------------------------------
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_moderation_status') THEN
          CREATE TYPE review_moderation_status AS ENUM ('visible', 'flagged', 'hidden');
        END IF;
      END $$;
    `);
    console.log('Ensured review_moderation_status enum exists.');

    // -------------------------------------------------------------------------
    // 3. reviews table + indices + constraints
    // -------------------------------------------------------------------------
    await client.query('BEGIN');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS reviews (
          id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id           uuid NOT NULL,
          customer_id        uuid NOT NULL,
          restaurant_id      uuid NOT NULL,
          stars              smallint NOT NULL,
          comment            text,
          tags               text[],
          moderation_status  review_moderation_status NOT NULL DEFAULT 'visible',
          moderation_reason  text,
          created_at         timestamp NOT NULL DEFAULT now(),
          updated_at         timestamp NOT NULL DEFAULT now(),
          CONSTRAINT reviews_order_id_unique UNIQUE (order_id),
          CONSTRAINT reviews_stars_check CHECK (stars BETWEEN 1 AND 5)
        );
      `);

      await client.query(
        `CREATE INDEX IF NOT EXISTS reviews_restaurant_id_moderation_idx
           ON reviews (restaurant_id, moderation_status);`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS reviews_customer_id_idx
           ON reviews (customer_id);`,
      );

      // -------------------------------------------------------------------------
      // 4. restaurants rating columns
      // -------------------------------------------------------------------------
      await client.query(
        `ALTER TABLE restaurants
           ADD COLUMN IF NOT EXISTS average_rating real NOT NULL DEFAULT 0`,
      );
      await client.query(
        `ALTER TABLE restaurants
           ADD COLUMN IF NOT EXISTS rating_sum integer NOT NULL DEFAULT 0`,
      );
      await client.query(
        `ALTER TABLE restaurants
           ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0`,
      );

      await client.query('COMMIT');
      console.log('Reviews table + restaurant rating columns applied.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    console.log('UC-22 review migration complete.');
  } catch (e) {
    console.error('Error applying review migration:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
