import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const images = pgTable(
  'images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicId: text('public_id').notNull(),
    secureUrl: text('secure_url').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('images_created_at_idx').on(table.createdAt)],
);

export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
