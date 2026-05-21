import 'dotenv/config';
import { db } from '../db';
import * as schema from '../schema';
import { v4 as uuidv4 } from 'uuid';
import { inArray, or } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';

/**
 * Nearby VNU (Làng Đại học) Seed Script
 *
 * This script adds restaurants and menu data near the location:
 * coordinates: [106.7918481, 10.8931869] (Longitude, Latitude)
 * Location: VNU-HCM University Village (Làng Đại học Quốc gia TP.HCM)
 *
 * It also populates the Ordering ACL snapshots to ensure "Add to Cart" works.
 */

type SeedImage = {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
};

const image = (
  publicId: string,
  remoteImageId: string,
  width = 1200,
  height = 800,
): SeedImage => ({
  publicId,
  secureUrl: `https://res.cloudinary.com/demo/image/fetch/c_fill,w_${width},h_${height},q_auto,f_auto/https://images.unsplash.com/${remoteImageId}`,
  width,
  height,
});

const seedImages = {
  bunChaLogo: image(
    'nearby-vnu/restaurants/bun-cha-logo',
    'photo-1555396273-367ea4eb4db5',
    512,
    512,
  ),
  bunChaCover: image(
    'nearby-vnu/restaurants/bun-cha-cover',
    'photo-1551218808-94e220e084d2',
  ),
  coffeeLogo: image(
    'nearby-vnu/restaurants/coffee-house-logo',
    'photo-1495474472287-4d71bcdd2085',
    512,
    512,
  ),
  coffeeCover: image(
    'nearby-vnu/restaurants/coffee-house-cover',
    'photo-1509042239860-f550ce710b93',
  ),
  comTamLogo: image(
    'nearby-vnu/restaurants/com-tam-logo',
    'photo-1504674900247-0877df9cc836',
    512,
    512,
  ),
  comTamCover: image(
    'nearby-vnu/restaurants/com-tam-cover',
    'photo-1544025162-d76694265947',
  ),
  bunChaSpecial: image(
    'nearby-vnu/menu/bun-cha-special',
    'photo-1569718212165-3a8278d5f624',
  ),
  bunChaRegular: image(
    'nearby-vnu/menu/bun-cha-regular',
    'photo-1559314809-0d155014e29e',
  ),
  peachTea: image('nearby-vnu/menu/peach-tea', 'photo-1556679343-c7306c1976bc'),
  blackTeaMacchiato: image(
    'nearby-vnu/menu/black-tea-macchiato',
    'photo-1572442388796-11668a67e53d',
  ),
  comTamSuon: image(
    'nearby-vnu/menu/com-tam-suon',
    'photo-1544025162-d76694265947',
  ),
  comTamCombo: image(
    'nearby-vnu/menu/com-tam-suon-bi-cha',
    'photo-1504674900247-0877df9cc836',
  ),
} satisfies Record<string, SeedImage>;

const nearbyVnuImages = Object.values(seedImages);

const nearbyVnuOwners = [
  {
    id: '44444444-4444-4444-8444-444444444401',
    accountId: '44444444-4444-4444-9444-444444444401',
    name: 'Bún Chả Owner',
    email: 'buncha-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'Bún Chả Làng Đại Học',
  },
  {
    id: '44444444-4444-4444-8444-444444444402',
    accountId: '44444444-4444-4444-9444-444444444402',
    name: 'Coffee House Owner',
    email: 'coffee-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'The Coffee House - KTX Khu B',
  },
  {
    id: '44444444-4444-4444-8444-444444444403',
    accountId: '44444444-4444-4444-9444-444444444403',
    name: 'Cơm Tấm Owner',
    email: 'comtam-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'Cơm Tấm Cali - Thủ Đức',
  },
];

const restaurantSeedNames = [
  'Bún Chả Làng Đại Học',
  'The Coffee House - KTX Khu B',
  'Cơm Tấm Cali - Thủ Đức',
];

function withSeedImage<T extends { price: number; imageUrl?: string }>(
  item: T,
): T & { imageUrl?: string } {
  if (item.imageUrl) return item;

  const imageByPrice: Record<number, string> = {
    42000: seedImages.blackTeaMacchiato.secureUrl,
    45000: seedImages.peachTea.secureUrl,
    65000: seedImages.comTamSuon.secureUrl,
    75000: seedImages.comTamCombo.secureUrl,
  };

  return {
    ...item,
    imageUrl: imageByPrice[item.price],
  };
}

async function main() {
  console.log('🌱 Starting nearby VNU seeding...');

  // 1. Seed dedicated owner users and credential accounts.
  const oldOwnerId = '44444444-4444-4444-8444-444444444444';
  const ownerIds = [oldOwnerId, ...nearbyVnuOwners.map((o) => o.id)];

  // 2. Clear old seed data for these owners and corresponding snapshots.
  console.log(`🗑  Cleaning up existing nearby VNU data...`);
  try {
    const existingRestaurants = await db
      .select({ id: schema.restaurants.id })
      .from(schema.restaurants)
      .where(
        or(
          inArray(schema.restaurants.ownerId, ownerIds),
          inArray(schema.restaurants.name, restaurantSeedNames),
        ),
      );

    if (existingRestaurants.length > 0) {
      const restaurantIds = existingRestaurants.map((r) => r.id);

      // Delete from snapshots first (Ordering and Notification BCs).
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
      await db
        .delete(schema.notificationRestaurantSnapshots)
        .where(
          inArray(
            schema.notificationRestaurantSnapshots.restaurantId,
            restaurantIds,
          ),
        );

      // Delete from upstream tables (Catalog BC)
      // Cascading deletes in schema might handle some, but we'll be explicit where safe
      await db
        .delete(schema.restaurants)
        .where(inArray(schema.restaurants.id, restaurantIds));
    }
    await db
      .delete(schema.account)
      .where(inArray(schema.account.userId, ownerIds));
    await db.delete(schema.user).where(inArray(schema.user.id, ownerIds));
    console.log('✅ Old seed data and snapshots cleared.');
    await db.delete(schema.images).where(
      inArray(
        schema.images.publicId,
        nearbyVnuImages.map((asset) => asset.publicId),
      ),
    );
  } catch (error: unknown) {
    console.warn(
      '⚠️  Warning: Could not clear old data:',
      error instanceof Error ? error.message : String(error),
    );
  }

  const now = new Date();

  for (const owner of nearbyVnuOwners) {
    const passwordHash = await hashPassword(owner.password);
    await db.insert(schema.user).values({
      id: owner.id,
      name: owner.name,
      email: owner.email,
      emailVerified: true,
      role: 'restaurant',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.account).values({
      id: owner.accountId,
      accountId: owner.id,
      providerId: 'credential',
      userId: owner.id,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    console.log(
      `Seeded restaurant owner account: ${owner.email} / ${owner.password} for ${owner.restaurantName}`,
    );
  }

  await db.insert(schema.images).values(nearbyVnuImages);
  console.log(`Seeded ${nearbyVnuImages.length} Cloudinary image records.`);

  // 3. Define Restaurants near the target location
  const restaurantsData = [
    {
      id: uuidv4(),
      ownerId: nearbyVnuOwners[0].id,
      name: 'Bún Chả Làng Đại Học',
      description:
        'Đặc sản Bún chả Hà Nội ngay tại Làng Đại học, thơm ngon nóng hổi.',
      address: 'Đường Nội Bộ Làng Đại học, Linh Trung, Thủ Đức, TP.HCM',
      phone: '0901234567',
      isOpen: true,
      isApproved: true,
      cuisineType: 'Vietnamese',
      logoUrl: seedImages.bunChaLogo.secureUrl,
      coverImageUrl: seedImages.bunChaCover.secureUrl,
      latitude: 10.8935,
      longitude: 106.792,
    },
    {
      id: uuidv4(),
      ownerId: nearbyVnuOwners[1].id,
      name: 'The Coffee House - KTX Khu B',
      description: 'Không gian học tập và thư giãn lý tưởng cho sinh viên.',
      address: 'KTX Khu B ĐHQG, Dĩ An, Bình Dương',
      phone: '18006936',
      isOpen: true,
      isApproved: true,
      cuisineType: 'Cafe',
      logoUrl: seedImages.coffeeLogo.secureUrl,
      coverImageUrl: seedImages.coffeeCover.secureUrl,
      latitude: 10.8928,
      longitude: 106.7915,
    },
    {
      id: uuidv4(),
      ownerId: nearbyVnuOwners[2].id,
      name: 'Cơm Tấm Cali - Thủ Đức',
      description: 'Hệ thống cơm tấm nổi tiếng với sườn nướng mật ong.',
      address: 'Xa lộ Hà Nội, Thủ Đức, TP.HCM',
      phone: '02838270101',
      isOpen: true,
      isApproved: true,
      cuisineType: 'Vietnamese',
      logoUrl: seedImages.comTamLogo.secureUrl,
      coverImageUrl: seedImages.comTamCover.secureUrl,
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
          imageUrl: seedImages.bunChaSpecial.secureUrl,
        },
        {
          id: uuidv4(),
          restaurantId: r.id,
          categoryId: catId,
          name: 'Bún chả thường',
          description: 'Chả miếng và chả viên.',
          price: 35000,
          status: 'available' as const,
          imageUrl: seedImages.bunChaRegular.secureUrl,
        },
      ];

      for (const item of items) {
        await db.insert(schema.menuItems).values(withSeedImage(item));

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
        await db.insert(schema.menuItems).values(withSeedImage(item));

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
        await db.insert(schema.menuItems).values(withSeedImage(item));

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
