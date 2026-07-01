import { z } from 'zod';

/**
 * Catalog service synchronous TCP RPC contracts (Phase 6).
 *
 * Pattern values are versioned strings used as Nest `@MessagePattern()` keys and
 * `ClientProxy.send()` patterns. The gateway translates public HTTP routes into
 * these patterns; the monolith keeps Ordering independent through events, not RPC.
 *
 * Mutations carry `internalAuth` — the gateway-issued short-lived internal JWT
 * (sub + roles + audience). Catalog verifies it and re-checks ownership; it never
 * trusts raw identity headers.
 */
export const CATALOG_RPC_PATTERNS = {
  // Restaurants
  listRestaurants: 'catalog.restaurant.list.v1',
  listRestaurantsAdmin: 'catalog.restaurant.list-admin.v1',
  getRestaurant: 'catalog.restaurant.get.v1',
  getRestaurantByOwner: 'catalog.restaurant.get-by-owner.v1',
  createRestaurant: 'catalog.restaurant.create.v1',
  updateRestaurant: 'catalog.restaurant.update.v1',
  setRestaurantApproved: 'catalog.restaurant.set-approved.v1',
  removeRestaurant: 'catalog.restaurant.remove.v1',
  attachRestaurantLogo: 'catalog.restaurant.attach-logo.v1',
  attachRestaurantCover: 'catalog.restaurant.attach-cover.v1',

  // Menu items
  listMenuItems: 'catalog.menu-item.list.v1',
  getMenuItem: 'catalog.menu-item.get.v1',
  createMenuItem: 'catalog.menu-item.create.v1',
  updateMenuItem: 'catalog.menu-item.update.v1',
  updateMenuItemImage: 'catalog.menu-item.update-image.v1',
  toggleMenuItemSoldOut: 'catalog.menu-item.toggle-sold-out.v1',
  removeMenuItem: 'catalog.menu-item.remove.v1',

  // Menu categories
  listMenuCategories: 'catalog.menu-category.list.v1',
  createMenuCategory: 'catalog.menu-category.create.v1',
  updateMenuCategory: 'catalog.menu-category.update.v1',
  removeMenuCategory: 'catalog.menu-category.remove.v1',

  // Modifiers
  listModifierGroups: 'catalog.modifier-group.list.v1',
  createModifierGroup: 'catalog.modifier-group.create.v1',
  updateModifierGroup: 'catalog.modifier-group.update.v1',
  removeModifierGroup: 'catalog.modifier-group.remove.v1',
  createModifierOption: 'catalog.modifier-option.create.v1',
  updateModifierOption: 'catalog.modifier-option.update.v1',
  removeModifierOption: 'catalog.modifier-option.remove.v1',

  // Delivery zones
  listDeliveryZones: 'catalog.delivery-zone.list.v1',
  createDeliveryZone: 'catalog.delivery-zone.create.v1',
  updateDeliveryZone: 'catalog.delivery-zone.update.v1',
  removeDeliveryZone: 'catalog.delivery-zone.remove.v1',
  estimateDelivery: 'catalog.delivery-zone.estimate.v1',

  // Search
  search: 'catalog.search.query.v1',
  searchAi: 'catalog.search.ai.v1',

  // Nutrition
  getNutrition: 'catalog.nutrition.get.v1',
  analyzeNutrition: 'catalog.nutrition.analyze.v1',
  startManualNutrition: 'catalog.nutrition.manual-session.v1',
  calculateNutrition: 'catalog.nutrition.calculate.v1',
  upsertNutrition: 'catalog.nutrition.upsert.v1',

  // Dietary tags
  listDietaryTags: 'catalog.dietary-tag.list.v1',
  listAllDietaryTags: 'catalog.dietary-tag.list-all.v1',
  createDietaryTag: 'catalog.dietary-tag.create.v1',
  updateDietaryTag: 'catalog.dietary-tag.update.v1',
  removeDietaryTag: 'catalog.dietary-tag.remove.v1',
} as const;

export type CatalogRpcPattern =
  (typeof CATALOG_RPC_PATTERNS)[keyof typeof CATALOG_RPC_PATTERNS];

// ---------------------------------------------------------------------------
// Shared RPC envelope pieces
// ---------------------------------------------------------------------------

/** Stable RPC error envelope translated back to HTTP status at the gateway. */
export const catalogRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
});
export type CatalogRpcError = z.infer<typeof catalogRpcErrorSchema>;

/** Caller context attached to every mutating request. */
export const internalCallerSchema = z.object({
  /** Gateway-issued internal JWT (sub + roles + audience). */
  internalAuth: z.string().min(1),
});

const paginationSchema = z.object({
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Representative read schemas (the full request/response set is completed with
// the handler implementation in step 4; these establish the shape + envelope).
// ---------------------------------------------------------------------------

export const getRestaurantRequestSchema = z.object({
  id: z.string().uuid(),
});
export type GetRestaurantRequest = z.infer<typeof getRestaurantRequestSchema>;

export const restaurantSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  isOpen: z.boolean(),
  isApproved: z.boolean(),
  ownerId: z.string().uuid(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  cuisineType: z.string().nullable(),
  averageRating: z.number().nullable(),
  reviewCount: z.number().int().nonnegative(),
});
export type RestaurantSummary = z.infer<typeof restaurantSummarySchema>;

export const listRestaurantsRequestSchema = paginationSchema.extend({
  approvedOnly: z.boolean().default(true),
});
export type ListRestaurantsRequest = z.infer<
  typeof listRestaurantsRequestSchema
>;

export const listRestaurantsResponseSchema = z.object({
  data: z.array(restaurantSummarySchema),
  total: z.number().int().nonnegative(),
});
export type ListRestaurantsResponse = z.infer<
  typeof listRestaurantsResponseSchema
>;
