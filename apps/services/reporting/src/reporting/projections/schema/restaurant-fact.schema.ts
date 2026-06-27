import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

/**
 * reporting_restaurant_facts: denormalized restaurant status maintained from
 * `catalog.restaurant.changed.v1` for online/offline/pending counts.
 */
export const reportingRestaurantFacts = pgTable('reporting_restaurant_facts', {
  restaurantId: uuid('restaurant_id').primaryKey(),
  name: text('name').notNull(),
  isApproved: boolean('is_approved').notNull().default(false),
  isOpen: boolean('is_open').notNull().default(false),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export type ReportingRestaurantFact =
  typeof reportingRestaurantFacts.$inferSelect;
export type NewReportingRestaurantFact =
  typeof reportingRestaurantFacts.$inferInsert;
