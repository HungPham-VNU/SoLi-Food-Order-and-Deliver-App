import { z } from 'zod';
import { EVENT_NAMES } from '../event-names';

/**
 * catalog.menu-item.changed.v1  (was MenuItemUpdatedEvent)
 *
 * `modifiers === null` means "this event carries no modifier data; the consumer
 * MUST preserve its existing snapshot modifiers". `[]` means "no modifier groups".
 */
const modifierOptionSnapshot = z.object({
  optionId: z.string(),
  optionName: z.string(),
  price: z.number(),
  isDefault: z.boolean(),
  isAvailable: z.boolean(),
});
const modifierGroupSnapshot = z.object({
  groupId: z.string(),
  groupName: z.string(),
  minSelections: z.number().int(),
  maxSelections: z.number().int(),
  options: z.array(modifierOptionSnapshot),
});

export const catalogMenuItemChangedV1Payload = z.object({
  menuItemId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string(),
  price: z.number().int(),
  status: z.enum(['available', 'unavailable', 'out_of_stock']),
  modifiers: z.array(modifierGroupSnapshot).nullable(),
});
export type CatalogMenuItemChangedV1Payload = z.infer<
  typeof catalogMenuItemChangedV1Payload
>;
export const CATALOG_MENU_ITEM_CHANGED_V1 = {
  eventType: EVENT_NAMES.CatalogMenuItemChanged,
  eventVersion: 1,
  schema: catalogMenuItemChangedV1Payload,
} as const;

/** catalog.restaurant.changed.v1  (was RestaurantUpdatedEvent) */
export const catalogRestaurantChangedV1Payload = z.object({
  restaurantId: z.string().uuid(),
  name: z.string(),
  isOpen: z.boolean(),
  isApproved: z.boolean(),
  address: z.string(),
  ownerId: z.string().uuid(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  cuisineType: z.string().nullable().optional(),
});
export type CatalogRestaurantChangedV1Payload = z.infer<
  typeof catalogRestaurantChangedV1Payload
>;
export const CATALOG_RESTAURANT_CHANGED_V1 = {
  eventType: EVENT_NAMES.CatalogRestaurantChanged,
  eventVersion: 1,
  schema: catalogRestaurantChangedV1Payload,
} as const;

/** catalog.delivery-zone.changed.v1  (was DeliveryZoneSnapshotUpdatedEvent) */
export const catalogDeliveryZoneChangedV1Payload = z.object({
  zoneId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string(),
  radiusKm: z.number(),
  baseFee: z.number().int(),
  perKmRate: z.number().int(),
  avgSpeedKmh: z.number(),
  prepTimeMinutes: z.number().int(),
  bufferMinutes: z.number().int(),
  isActive: z.boolean(),
  isDeleted: z.boolean(),
});
export type CatalogDeliveryZoneChangedV1Payload = z.infer<
  typeof catalogDeliveryZoneChangedV1Payload
>;
export const CATALOG_DELIVERY_ZONE_CHANGED_V1 = {
  eventType: EVENT_NAMES.CatalogDeliveryZoneChanged,
  eventVersion: 1,
  schema: catalogDeliveryZoneChangedV1Payload,
} as const;
