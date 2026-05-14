import 'dotenv/config';
import { db } from '../db';
import * as schema from '../schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

/**
 * Nearby VNU (Làng Đại học) Seed Script
 *
 * This script adds restaurants and menu data near the location:
 * coordinates: [106.7918481, 10.8931869] (Longitude, Latitude)
 * Location: VNU-HCM University Village (Làng Đại học Quốc gia TP.HCM)
 */

async function main() {
  console.log('🌱 Starting nearby VNU seeding...');

  // 1. Get an owner user (reusing Owner 1 from existing seed)
  const ownerId = '11111111-1111-4111-8111-111111111111';

  // 2. Clear old seed data for this owner (as requested)
  // Cascading deletes will handle menu items, categories, etc.
  console.log(`🗑  Cleaning up existing data for owner: ${ownerId}`);
  try {
    await db
      .delete(schema.restaurants)
      .where(eq(schema.restaurants.ownerId, ownerId));
    console.log('✅ Old seed data cleared.');
  } catch (error: any) {
    console.warn(
      '⚠️  Warning: Could not clear old data (might be empty or missing tables):',
      error.message,
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
    console.log(`✅ Seeded restaurant: ${r.name}`);

    // Create a default delivery zone for each
    const zoneId = uuidv4();
    await db.insert(schema.deliveryZones).values({
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

        await db.insert(schema.modifierOptions).values([
          {
            id: uuidv4(),
            groupId: modGroupId,
            name: 'Thêm bún',
            price: 5000,
            displayOrder: 1,
          },
          {
            id: uuidv4(),
            groupId: modGroupId,
            name: 'Thêm chả miếng',
            price: 15000,
            displayOrder: 2,
          },
          {
            id: uuidv4(),
            groupId: modGroupId,
            name: 'Thêm nem rán (1 cái)',
            price: 10000,
            displayOrder: 3,
          },
        ]);
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

        await db.insert(schema.modifierOptions).values([
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
            displayOrder: 2,
          },
        ]);

        const toppingGroupId = uuidv4();
        await db.insert(schema.modifierGroups).values({
          id: toppingGroupId,
          menuItemId: item.id,
          name: 'Topping',
          minSelections: 0,
          maxSelections: 3,
          displayOrder: 2,
        });

        await db.insert(schema.modifierOptions).values([
          {
            id: uuidv4(),
            groupId: toppingGroupId,
            name: 'Trân châu trắng',
            price: 10000,
            displayOrder: 1,
          },
          {
            id: uuidv4(),
            groupId: toppingGroupId,
            name: 'Đào miếng (2 miếng)',
            price: 10000,
            displayOrder: 2,
          },
          {
            id: uuidv4(),
            groupId: toppingGroupId,
            name: 'Kem Macchiato',
            price: 15000,
            displayOrder: 3,
          },
        ]);
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

        await db.insert(schema.modifierOptions).values([
          {
            id: uuidv4(),
            groupId: sideGroupId,
            name: 'Thêm cơm',
            price: 10000,
            displayOrder: 1,
          },
          {
            id: uuidv4(),
            groupId: sideGroupId,
            name: 'Trứng ốp la',
            price: 10000,
            displayOrder: 2,
          },
          {
            id: uuidv4(),
            groupId: sideGroupId,
            name: 'Thêm chả trứng',
            price: 15000,
            displayOrder: 3,
          },
          {
            id: uuidv4(),
            groupId: sideGroupId,
            name: 'Thêm bì',
            price: 10000,
            displayOrder: 4,
          },
        ]);
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
