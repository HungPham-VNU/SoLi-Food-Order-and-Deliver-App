import 'dotenv/config';
import { db } from '../db';
import * as schema from '../schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, inArray } from 'drizzle-orm';

/**
 * Nearby VNU (Làng Đại học) Seed Script
 *
 * This script adds restaurants and menu data near the location:
 * coordinates: [106.7918481, 10.8931869] (Longitude, Latitude)
 * Location: VNU-HCM University Village (Làng Đại học Quốc gia TP.HCM)
 *
 * It also populates the Ordering ACL snapshots to ensure "Add to Cart" works.
 */

async function main() {
  console.log('🌱 Starting nearby VNU seeding...');

  // 1. Get an owner user (reusing Owner 1 from existing seed)
  const ownerId = '11111111-1111-4111-8111-111111111111';

  // 2. Clear old seed data for this owner and corresponding snapshots
  console.log(`🗑  Cleaning up existing data for owner: ${ownerId}`);
  try {
    const existingRestaurants = await db
      .select({ id: schema.restaurants.id })
      .from(schema.restaurants)
      .where(eq(schema.restaurants.ownerId, ownerId));

    if (existingRestaurants.length > 0) {
      const restaurantIds = existingRestaurants.map((r) => r.id);

      // Delete from snapshots first (Ordering BC)
      await db
        .delete(schema.orderingMenuItemSnapshots)
        .where(
          inArray(schema.orderingMenuItemSnapshots.restaurantId, restaurantIds),
        );
      await db
        .delete(schema.orderingDeliveryZoneSnapshots)
        .where(
          inArray(
            schema.orderingDeliveryZoneSnapshots.restaurantId,
            restaurantIds,
          ),
        );
      await db
        .delete(schema.orderingRestaurantSnapshots)
        .where(
          inArray(
            schema.orderingRestaurantSnapshots.restaurantId,
            restaurantIds,
          ),
        );

      // Delete from upstream tables (Catalog BC)
      // Cascading deletes in schema might handle some, but we'll be explicit where safe
      await db
        .delete(schema.restaurants)
        .where(eq(schema.restaurants.ownerId, ownerId));
    }
    console.log('✅ Old seed data and snapshots cleared.');
  } catch (error: unknown) {
    console.warn(
      '⚠️  Warning: Could not clear old data:',
      error instanceof Error ? error.message : String(error),
    );
  }

  // 3. Define Restaurants near the target location
  const restaurantsData = [
    {
      id: uuidv4(),
      ownerId,
      name: 'Bún Chả Làng Đại Học',
      description:
        'Đặc sản Bún chả Hà Nội ngay tại Làng Đại học, thơm ngon nóng hổi.',
      address: 'Đường Nội Bộ Làng Đại học, Linh Trung, Thủ Đức, TP.HCM',
      phone: '0901234567',
      isOpen: true,
      isApproved: true,
      cuisineType: 'Vietnamese',
      latitude: 10.8935,
      longitude: 106.792,
    },
    {
      id: uuidv4(),
      ownerId,
      name: 'The Coffee House - KTX Khu B',
      description: 'Không gian học tập và thư giãn lý tưởng cho sinh viên.',
      address: 'KTX Khu B ĐHQG, Dĩ An, Bình Dương',
      phone: '18006936',
      isOpen: true,
      isApproved: true,
      cuisineType: 'Cafe',
      latitude: 10.8928,
      longitude: 106.7915,
    },
    {
      id: uuidv4(),
      ownerId,
      name: 'Cơm Tấm Cali - Thủ Đức',
      description: 'Hệ thống cơm tấm nổi tiếng với sườn nướng mật ong.',
      address: 'Xa lộ Hà Nội, Thủ Đức, TP.HCM',
      phone: '02838270101',
      isOpen: true,
      isApproved: true,
      cuisineType: 'Vietnamese',
      latitude: 10.894,
      longitude: 106.791,
    },
  ];

  for (const r of restaurantsData) {
    await db.insert(schema.restaurants).values(r);

    // Create Ordering snapshot
    await db.insert(schema.orderingRestaurantSnapshots).values({
      restaurantId: r.id,
      name: r.name,
      isOpen: r.isOpen,
      isApproved: r.isApproved,
      address: r.address,
      cuisineType: r.cuisineType,
      latitude: r.latitude,
      longitude: r.longitude,
      ownerId: r.ownerId,
    });

    console.log(`✅ Seeded restaurant: ${r.name}`);

    // Create a default delivery zone for each
    const zoneId = uuidv4();
    const zoneData = {
      id: zoneId,
      restaurantId: r.id,
      name: 'Khu vực Làng Đại học (3km)',
      radiusKm: 10,
      baseFee: 10000,
      perKmRate: 4000,
      avgSpeedKmh: 25,
      prepTimeMinutes: 15,
      bufferMinutes: 5,
      isActive: true,
    };
    await db.insert(schema.deliveryZones).values(zoneData);

    // Create Ordering snapshot for delivery zone
    await db.insert(schema.orderingDeliveryZoneSnapshots).values({
      zoneId: zoneData.id,
      restaurantId: zoneData.restaurantId,
      name: zoneData.name,
      radiusKm: zoneData.radiusKm,
      baseFee: zoneData.baseFee,
      perKmRate: zoneData.perKmRate,
      avgSpeedKmh: zoneData.avgSpeedKmh,
      prepTimeMinutes: zoneData.prepTimeMinutes,
      bufferMinutes: zoneData.bufferMinutes,
      isActive: zoneData.isActive,
    });

    // Add some menu categories, items, and modifier groups
    if (r.name === 'Bún Chả Làng Đại Học') {
      const catId = uuidv4();
      await db.insert(schema.menuCategories).values({
        id: catId,
        restaurantId: r.id,
        name: 'Món Chính',
        displayOrder: 1,
      });

      const items = [
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catId,
          name: 'Bún chả đặc biệt',
          description: 'Đầy đủ chả miếng, chả viên, nem rán.',
          price: 45000,
          status: 'available' as const,
        },
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catId,
          name: 'Bún chả thường',
          description: 'Chả miếng và chả viên.',
          price: 35000,
          status: 'available' as const,
        },
      ];

      for (const item of items) {
        await db.insert(schema.menuItems).values(item);

        const modGroupId = uuidv4();
        await db.insert(schema.modifierGroups).values({
          id: modGroupId,
          menuItemId: item.id,
          name: 'Thêm đồ ăn',
          minSelections: 0,
          maxSelections: 5,
          displayOrder: 1,
        });

        const options = [
          {
            id: uuidv4(),
            groupId: modGroupId,
            name: 'Thêm bún',
            price: 5000,
            displayOrder: 1,
            isDefault: false,
          },
          {
            id: uuidv4(),
            groupId: modGroupId,
            name: 'Thêm chả miếng',
            price: 15000,
            displayOrder: 2,
            isDefault: false,
          },
          {
            id: uuidv4(),
            groupId: modGroupId,
            name: 'Thêm nem rán (1 cái)',
            price: 10000,
            displayOrder: 3,
            isDefault: false,
          },
        ];

        await db.insert(schema.modifierOptions).values(options);

        // Create Ordering snapshot for menu item (including modifiers)
        await db.insert(schema.orderingMenuItemSnapshots).values({
          menuItemId: item.id,
          restaurantId: item.restaurantId,
          name: item.name,
          price: item.price,
          status: item.status,
          modifiers: [
            {
              groupId: modGroupId,
              groupName: 'Thêm đồ ăn',
              minSelections: 0,
              maxSelections: 5,
              options: options.map((o) => ({
                optionId: o.id,
                name: o.name,
                price: o.price,
                isDefault: o.isDefault,
                isAvailable: true,
              })),
            },
          ],
        });
      }
    } else if (r.name === 'The Coffee House - KTX Khu B') {
      const catId = uuidv4();
      await db.insert(schema.menuCategories).values({
        id: catId,
        restaurantId: r.id,
        name: 'Trà trái cây',
        displayOrder: 1,
      });

      const items = [
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catId,
          name: 'Trà đào cam sả',
          description: 'Thức uống signature của The Coffee House.',
          price: 45000,
          status: 'available' as const,
        },
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catId,
          name: 'Trà đen macchiato',
          description: 'Lớp kem béo ngậy trên nền trà đen đậm đà.',
          price: 42000,
          status: 'available' as const,
        },
      ];

      for (const item of items) {
        await db.insert(schema.menuItems).values(item);

        const sizeGroupId = uuidv4();
        await db.insert(schema.modifierGroups).values({
          id: sizeGroupId,
          menuItemId: item.id,
          name: 'Kích cỡ',
          minSelections: 1,
          maxSelections: 1,
          displayOrder: 1,
        });

        const sizeOptions = [
          {
            id: uuidv4(),
            groupId: sizeGroupId,
            name: 'Size M',
            price: 0,
            isDefault: true,
            displayOrder: 1,
          },
          {
            id: uuidv4(),
            groupId: sizeGroupId,
            name: 'Size L',
            price: 10000,
            isDefault: false,
            displayOrder: 2,
          },
        ];
        await db.insert(schema.modifierOptions).values(sizeOptions);

        const toppingGroupId = uuidv4();
        await db.insert(schema.modifierGroups).values({
          id: toppingGroupId,
          menuItemId: item.id,
          name: 'Topping',
          minSelections: 0,
          maxSelections: 3,
          displayOrder: 2,
        });

        const toppingOptions = [
          {
            id: uuidv4(),
            groupId: toppingGroupId,
            name: 'Trân châu trắng',
            price: 10000,
            isDefault: false,
            displayOrder: 1,
          },
          {
            id: uuidv4(),
            groupId: toppingGroupId,
            name: 'Đào miếng (2 miếng)',
            price: 10000,
            isDefault: false,
            displayOrder: 2,
          },
          {
            id: uuidv4(),
            groupId: toppingGroupId,
            name: 'Kem Macchiato',
            price: 15000,
            isDefault: false,
            displayOrder: 3,
          },
        ];
        await db.insert(schema.modifierOptions).values(toppingOptions);

        // Create Ordering snapshot
        await db.insert(schema.orderingMenuItemSnapshots).values({
          menuItemId: item.id,
          restaurantId: item.restaurantId,
          name: item.name,
          price: item.price,
          status: item.status,
          modifiers: [
            {
              groupId: sizeGroupId,
              groupName: 'Kích cỡ',
              minSelections: 1,
              maxSelections: 1,
              options: sizeOptions.map((o) => ({
                optionId: o.id,
                name: o.name,
                price: o.price,
                isDefault: !!o.isDefault,
                isAvailable: true,
              })),
            },
            {
              groupId: toppingGroupId,
              groupName: 'Topping',
              minSelections: 0,
              maxSelections: 3,
              options: toppingOptions.map((o) => ({
                optionId: o.id,
                name: o.name,
                price: o.price,
                isDefault: !!o.isDefault,
                isAvailable: true,
              })),
            },
          ],
        });
      }
    } else if (r.name === 'Cơm Tấm Cali - Thủ Đức') {
      const catId = uuidv4();
      await db.insert(schema.menuCategories).values({
        id: catId,
        restaurantId: r.id,
        name: 'Cơm Tấm',
        displayOrder: 1,
      });

      const items = [
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catId,
          name: 'Cơm tấm sườn nướng mật ong',
          description: 'Sườn nướng mật ong thơm lừng, kèm đồ chua và mỡ hành.',
          price: 65000,
          status: 'available' as const,
        },
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catId,
          name: 'Cơm tấm sườn bì chả',
          description: 'Combo truyền thống đầy đủ sườn, bì và chả trứng.',
          price: 75000,
          status: 'available' as const,
        },
      ];

      for (const item of items) {
        await db.insert(schema.menuItems).values(item);

        const sideGroupId = uuidv4();
        await db.insert(schema.modifierGroups).values({
          id: sideGroupId,
          menuItemId: item.id,
          name: 'Món thêm',
          minSelections: 0,
          maxSelections: 5,
          displayOrder: 1,
        });

        const sideOptions = [
          {
            id: uuidv4(),
            groupId: sideGroupId,
            name: 'Thêm cơm',
            price: 10000,
            isDefault: false,
            displayOrder: 1,
          },
          {
            id: uuidv4(),
            groupId: sideGroupId,
            name: 'Trứng ốp la',
            price: 10000,
            isDefault: false,
            displayOrder: 2,
          },
          {
            id: uuidv4(),
            groupId: sideGroupId,
            name: 'Thêm chả trứng',
            price: 15000,
            isDefault: false,
            displayOrder: 3,
          },
          {
            id: uuidv4(),
            groupId: sideGroupId,
            name: 'Thêm bì',
            price: 10000,
            isDefault: false,
            displayOrder: 4,
          },
        ];
        await db.insert(schema.modifierOptions).values(sideOptions);

        // Create Ordering snapshot
        await db.insert(schema.orderingMenuItemSnapshots).values({
          menuItemId: item.id,
          restaurantId: item.restaurantId,
          name: item.name,
          price: item.price,
          status: item.status,
          modifiers: [
            {
              groupId: sideGroupId,
              groupName: 'Món thêm',
              minSelections: 0,
              maxSelections: 5,
              options: sideOptions.map((o) => ({
                optionId: o.id,
                name: o.name,
                price: o.price,
                isDefault: !!o.isDefault,
                isAvailable: true,
              })),
            },
          ],
        });
      }
    }
  }

  console.log('✨ Nearby VNU seeding completed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
