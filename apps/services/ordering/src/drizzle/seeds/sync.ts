/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as catalogSchema from '../../../../catalog/src/drizzle/schema';
import * as orderingSchema from '../drizzle/schema';
import { sql } from 'drizzle-orm';

const catalogUrl =
  process.env.CATALOG_DATABASE_URL ||
  'postgresql://uitfood_catalog:catalog_secret@localhost:5432/uitfood_catalog';
const orderingUrl =
  process.env.ORDERING_DATABASE_URL ||
  'postgresql://uitfood_ordering:ordering_secret@localhost:5432/uitfood_ordering';

const catalogPool = new Pool({ connectionString: catalogUrl });
const orderingPool = new Pool({ connectionString: orderingUrl });

const catalogDb = drizzle(catalogPool, { schema: catalogSchema });
const orderingDb = drizzle(orderingPool, { schema: orderingSchema });

async function sync() {
  console.log('Fetching from catalog...');
  const restaurants = await catalogDb.select().from(catalogSchema.restaurants);

  for (const r of restaurants) {
    await orderingDb
      .insert(orderingSchema.orderingRestaurantSnapshots)
      .values({
        restaurantId: r.id,
        name: r.name,
        isOpen: r.isOpen ?? false,
        isApproved: r.isApproved ?? false,
        address: r.address,
        cuisineType: r.cuisineType,
        latitude: r.latitude,
        longitude: r.longitude,
        ownerId: r.ownerId,
      })
      .onConflictDoNothing();
  }
  console.log('Synced restaurants.');

  const zones = await catalogDb.select().from(catalogSchema.deliveryZones);
  for (const z of zones) {
    await orderingDb
      .insert(orderingSchema.orderingDeliveryZoneSnapshots)
      .values({
        zoneId: z.id,
        restaurantId: z.restaurantId,
        radiusKm: z.radiusKm,
        baseFee: z.baseFee,
        perKmRate: z.perKmRate,
        avgSpeedKmh: z.avgSpeedKmh,
        prepTimeMinutes: z.prepTimeMinutes,
        bufferMinutes: z.bufferMinutes,
        isActive: z.isActive,
      })
      .onConflictDoNothing();
  }
  console.log('Synced delivery zones.');

  const items = await catalogDb.select().from(catalogSchema.menuItems);
  for (const item of items) {
    // Need to get modifiers from catalog to build the JSONB
    const groups = await catalogDb
      .select()
      .from(catalogSchema.modifierGroups)
      .where(sql`${catalogSchema.modifierGroups.menuItemId} = ${item.id}`);

    const modifiers = [];
    for (const g of groups) {
      const options = await catalogDb
        .select()
        .from(catalogSchema.modifierOptions)
        .where(sql`${catalogSchema.modifierOptions.groupId} = ${g.id}`);

      modifiers.push({
        groupId: g.id,
        groupName: g.name,
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        options: options.map((o) => ({
          optionId: o.id,
          optionName: o.name,
          price: o.price,
          isDefault: o.isDefault,
          isAvailable: o.isAvailable,
        })),
      });
    }

    await orderingDb
      .insert(orderingSchema.orderingMenuItemSnapshots)
      .values({
        menuItemId: item.id,
        restaurantId: item.restaurantId,
        name: item.name,
        price: item.price,
        status: item.status,
        modifiers: modifiers,
      })
      .onConflictDoNothing();
  }
  console.log('Synced menu items.');

  await catalogPool.end();
  await orderingPool.end();
}

sync().catch(console.error);
