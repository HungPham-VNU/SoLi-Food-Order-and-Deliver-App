import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  customType,
} from 'drizzle-orm/pg-core';

function parseVector(value: string): number[] {
  const parsed: unknown = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) => typeof item === 'number')
  ) {
    throw new Error('Invalid vector value from database.');
  }

  return parsed;
}

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return parseVector(value);
  },
});

export const restaurants = pgTable(
  'restaurants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    searchDocument: text('search_document'),
    searchContentHash: text('search_content_hash'),
    embedding: vector('embedding'),
    embeddingModel: text('embedding_model'),
    embeddingVersion: text('embedding_version'),
    embeddingGeneratedAt: timestamp('embedding_generated_at'),
    address: text('address').notNull(),
    phone: text('phone').notNull(),
    isOpen: boolean('is_open').notNull().default(false),
    isApproved: boolean('is_approved').notNull().default(false),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    // Catalog enrichment fields (Issue #10): cuisine type for filtering/search,
    // logo and cover images for UI display.
    cuisineType: text('cuisine_type'),
    logoUrl: text('logo_url'),
    coverImageUrl: text('cover_image_url'),
    // Rating projection (UC-22). averageRating is denormalized for fast
    // public reads; ratingSum + reviewCount are the authoritative integer
    // counters maintained inside SubmitReviewHandler's transaction (BR-22.12).
    averageRating: real('average_rating').notNull().default(0),
    ratingSum: integer('rating_sum').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    // Composite index speeds up the most common public query:
    // WHERE is_approved = true AND is_open = true (Issue #14).
    index('restaurants_approved_open_idx').on(table.isApproved, table.isOpen),
    index('restaurants_rating_idx').on(table.averageRating, table.reviewCount),
  ],
);

export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;

export const deliveryZones = pgTable('delivery_zones', {
  id: uuid('id').defaultRandom().primaryKey(),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  radiusKm: doublePrecision('radius_km').notNull(),
  // Fees stored as integer VND (no fractional currency in Vietnam).
  baseFee: integer('base_fee').notNull().default(0),
  perKmRate: integer('per_km_rate').notNull().default(0),
  avgSpeedKmh: real('avg_speed_kmh').notNull().default(30),
  prepTimeMinutes: real('prep_time_minutes').notNull().default(15),
  bufferMinutes: real('buffer_minutes').notNull().default(5),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type NewDeliveryZone = typeof deliveryZones.$inferInsert;
