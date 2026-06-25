import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const dietaryTagCategoryEnum = pgEnum('dietary_tag_category', [
  'dietary',
  'lifestyle',
]);

export type DietaryTagCategory =
  (typeof dietaryTagCategoryEnum.enumValues)[number];

export const dietaryTags = pgTable(
  'dietary_tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    description: text('description'),
    category: dietaryTagCategoryEnum('category').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('dietary_tags_slug_unique').on(table.slug),
    uniqueIndex('dietary_tags_name_lower_unique').on(sql`lower(${table.name})`),
    index('dietary_tags_active_category_idx').on(
      table.isActive,
      table.category,
    ),
  ],
);

export type DietaryTag = typeof dietaryTags.$inferSelect;
export type NewDietaryTag = typeof dietaryTags.$inferInsert;
