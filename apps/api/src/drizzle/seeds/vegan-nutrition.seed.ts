import 'dotenv/config';
import { hashPassword } from 'better-auth/crypto';
import { inArray, or, sql } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../schema';
import type {
  ExtractedRecipe,
  IngredientCategory,
  NutritionAmount,
  NutritionUnit,
  PreparationState,
} from '../../module/restaurant-catalog/nutrition/types/nutrition.types';

/**
 * Vegan nutrition seed.
 *
 * Adds two restaurants near:
 *   latitude: 10.8928
 *   longitude: 106.7915
 *
 * 1. Green Leaf Vegan (100% vegan)
 * 2. Harmony Eats (Mixed vegan and normal food)
 *
 * Each restaurant has its own restaurant-owner account and 3 menu items.
 */

type SeedImage = {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
};

type NutritionFoodSeed = {
  key: string;
  nameVi: string;
  nameEn: string;
  aliases: string[];
  category: string;
  state: 'raw' | 'cooked' | 'fried' | 'boiled' | 'grilled' | 'unknown';
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  fiber100g: number;
  sugar100g: number;
  sodium100g: number;
};

type RecipeIngredientSeed = {
  foodKey: string;
  name: string;
  canonicalNameEn: string;
  quantity: number;
  unit: NutritionUnit;
  quantityGram: number;
  preparation: PreparationState;
  category: IngredientCategory;
};

type MenuItemSeed = {
  id: string;
  analysisSessionId: string;
  name: string;
  description: string;
  price: number;
  tags: string[];
  imageUrl: string;
  servings: number;
  ingredients: RecipeIngredientSeed[];
};

type RestaurantSeed = {
  id: string;
  ownerId: string;
  categoryId: string;
  zoneId: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  cuisineType: string;
  logoUrl: string;
  coverImageUrl: string;
  latitude: number;
  longitude: number;
  categoryName: string;
  items: MenuItemSeed[];
};

const TARGET_LATITUDE = 10.8928;
const TARGET_LONGITUDE = 106.7915;

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
  greenLeafLogo: image(
    'vegan-nutrition/restaurants/green-leaf-logo',
    'photo-1498837167922-ddd27525d352',
    512,
    512,
  ),
  greenLeafCover: image(
    'vegan-nutrition/restaurants/green-leaf-cover',
    'photo-1512621776951-a57141f2eefd',
  ),
  harmonyEatsLogo: image(
    'vegan-nutrition/restaurants/harmony-eats-logo',
    'photo-1504674900247-0877df9cc836',
    512,
    512,
  ),
  harmonyEatsCover: image(
    'vegan-nutrition/restaurants/harmony-eats-cover',
    'photo-1546069901-ba9599a7e63c',
  ),
  veganBuddhaBowl: image(
    'vegan-nutrition/menu/vegan-buddha-bowl',
    'photo-1512621776951-a57141f2eefd',
  ),
  veganBanhMi: image(
    'vegan-nutrition/menu/vegan-banh-mi',
    'photo-1509722747041-616f39b57569',
  ),
  veganSpringRolls: image(
    'vegan-nutrition/menu/vegan-spring-rolls',
    'photo-1559847844-5315695dadae',
  ),
  chickenRice: image(
    'vegan-nutrition/menu/chicken-rice',
    'photo-1562967916-eb82221dfb92',
  ),
  grilledPorkVermicelli: image(
    'vegan-nutrition/menu/grilled-pork-vermicelli',
    'photo-1544025162-d76694265947',
  ),
  veganMushroomPho: image(
    'vegan-nutrition/menu/vegan-mushroom-pho',
    'photo-1582878826629-29b7ad1cdc43',
  ),
} satisfies Record<string, SeedImage>;

const veganNutritionImages = Object.values(seedImages);

function seedId(group: number, index: number): string {
  return `570000${group.toString().padStart(2, '0')}-0000-4000-8000-${index
    .toString()
    .padStart(12, '0')}`;
}

const veganNutritionOwners = [
  {
    id: seedId(1, 1),
    accountId: seedId(2, 1),
    name: 'Green Leaf Vegan Owner',
    email: 'green-leaf-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'Green Leaf Vegan',
  },
  {
    id: seedId(1, 2),
    accountId: seedId(2, 2),
    name: 'Harmony Eats Owner',
    email: 'harmony-eats-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'Harmony Eats',
  },
];

const nutritionFoodSeeds: NutritionFoodSeed[] = [
  nutritionFood('whiteRiceCooked', 'com trang nau chin', 'cooked white rice', {
    aliases: ['white rice', 'steamed rice', 'com trang'],
    category: 'grain',
    state: 'cooked',
    calories100g: 130,
    protein100g: 2.7,
    carbs100g: 28.2,
    fat100g: 0.3,
    fiber100g: 0.4,
    sugar100g: 0.1,
    sodium100g: 1,
  }),
  nutritionFood(
    'riceVermicelliCooked',
    'bun tuoi nau chin',
    'cooked rice vermicelli',
    {
      aliases: ['rice vermicelli', 'bun tuoi', 'rice noodles'],
      category: 'grain',
      state: 'cooked',
      calories100g: 110,
      protein100g: 1.7,
      carbs100g: 25.7,
      fat100g: 0.2,
      fiber100g: 0.5,
      sugar100g: 0.1,
      sodium100g: 10,
    },
  ),
  nutritionFood(
    'vietnameseBaguette',
    'banh mi viet nam',
    'Vietnamese baguette',
    {
      aliases: ['baguette', 'banh mi bread'],
      category: 'grain',
      state: 'cooked',
      calories100g: 270,
      protein100g: 8.5,
      carbs100g: 55,
      fat100g: 1.5,
      fiber100g: 2.5,
      sugar100g: 3.8,
      sodium100g: 540,
    },
  ),
  nutritionFood('tofuFirm', 'dau hu', 'firm tofu', {
    aliases: ['tofu', 'dau phu'],
    category: 'protein',
    state: 'cooked',
    calories100g: 144,
    protein100g: 17.3,
    carbs100g: 2.8,
    fat100g: 8.7,
    fiber100g: 2.3,
    sugar100g: 0.6,
    sodium100g: 14,
  }),
  nutritionFood('mushroomCooked', 'nam nau chin', 'cooked mushroom', {
    aliases: ['mushroom', 'nam'],
    category: 'vegetable',
    state: 'cooked',
    calories100g: 22,
    protein100g: 3.1,
    carbs100g: 3.3,
    fat100g: 0.3,
    fiber100g: 1,
    sugar100g: 1.5,
    sodium100g: 5,
  }),
  nutritionFood(
    'chickenBreastGrilled',
    'uc ga nuong',
    'grilled chicken breast',
    {
      aliases: ['chicken breast', 'grilled chicken', 'uc ga'],
      category: 'protein',
      state: 'grilled',
      calories100g: 165,
      protein100g: 31,
      carbs100g: 0,
      fat100g: 3.6,
      fiber100g: 0,
      sugar100g: 0,
      sodium100g: 74,
    },
  ),
  nutritionFood('porkChopGrilled', 'suon heo nuong', 'grilled pork chop', {
    aliases: ['pork chop', 'grilled pork chop', 'suon nuong'],
    category: 'protein',
    state: 'grilled',
    calories100g: 231,
    protein100g: 25,
    carbs100g: 0,
    fat100g: 14,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 76,
  }),
  nutritionFood('lettuce', 'xa lach', 'lettuce', {
    aliases: ['green lettuce', 'salad greens'],
    category: 'vegetable',
    state: 'raw',
    calories100g: 15,
    protein100g: 1.4,
    carbs100g: 2.9,
    fat100g: 0.2,
    fiber100g: 1.3,
    sugar100g: 0.8,
    sodium100g: 28,
  }),
  nutritionFood('cucumber', 'dua leo', 'cucumber', {
    aliases: ['cucumber slices'],
    category: 'vegetable',
    state: 'raw',
    calories100g: 15,
    protein100g: 0.7,
    carbs100g: 3.6,
    fat100g: 0.1,
    fiber100g: 0.5,
    sugar100g: 1.7,
    sodium100g: 2,
  }),
  nutritionFood('carrotRaw', 'ca rot song', 'raw carrot', {
    aliases: ['carrot', 'shredded carrot'],
    category: 'vegetable',
    state: 'raw',
    calories100g: 41,
    protein100g: 0.9,
    carbs100g: 9.6,
    fat100g: 0.2,
    fiber100g: 2.8,
    sugar100g: 4.7,
    sodium100g: 69,
  }),
  nutritionFood('soySauce', 'nuoc tuong', 'soy sauce', {
    aliases: ['soy sauce'],
    category: 'sauce',
    state: 'unknown',
    calories100g: 53,
    protein100g: 8.1,
    carbs100g: 4.9,
    fat100g: 0.6,
    fiber100g: 0.8,
    sugar100g: 0.4,
    sodium100g: 5493,
  }),
];

const restaurantsData: RestaurantSeed[] = [
  {
    id: seedId(3, 1),
    ownerId: veganNutritionOwners[0].id,
    categoryId: seedId(4, 1),
    zoneId: seedId(5, 1),
    name: 'Green Leaf Vegan',
    description: '100% plant-based healthy meals near VNU.',
    address:
      'Internal Road, VNU-HCM University Village, Linh Trung, Thu Duc, HCMC',
    phone: '0905602001',
    cuisineType: 'Vegan',
    logoUrl: seedImages.greenLeafLogo.secureUrl,
    coverImageUrl: seedImages.greenLeafCover.secureUrl,
    latitude: TARGET_LATITUDE + 0.0001,
    longitude: TARGET_LONGITUDE - 0.00015,
    categoryName: 'Vegan Delights',
    items: [
      item(1, 'Vegan Buddha Bowl', {
        description:
          'Tofu, cooked mushrooms, lettuce, cucumber, carrots, and soy sauce over white rice.',
        price: 65000,
        tags: ['vegan', 'vegetarian'],
        imageUrl: seedImages.veganBuddhaBowl.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('tofuFirm', 'firm tofu', 100, 'g', 'cooked', 'main'),
          ingredient(
            'mushroomCooked',
            'cooked mushroom',
            50,
            'g',
            'cooked',
            'main',
          ),
          ingredient(
            'whiteRiceCooked',
            'cooked white rice',
            150,
            'g',
            'cooked',
            'main',
          ),
          ingredient('lettuce', 'lettuce', 40, 'g', 'raw', 'main'),
          ingredient('carrotRaw', 'shredded carrot', 30, 'g', 'raw', 'main'),
          ingredient(
            'soySauce',
            'soy sauce dressing',
            15,
            'g',
            'unknown',
            'sauce',
          ),
        ],
      }),
      item(2, 'Vegan Tofu Banh Mi', {
        description:
          'Crispy baguette with marinated firm tofu, cucumber, carrots, and soy sauce.',
        price: 45000,
        tags: ['vegan', 'vegetarian'],
        imageUrl: seedImages.veganBanhMi.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'vietnameseBaguette',
            'Vietnamese baguette',
            95,
            'g',
            'cooked',
            'main',
          ),
          ingredient('tofuFirm', 'firm tofu', 80, 'g', 'cooked', 'main'),
          ingredient('cucumber', 'cucumber', 30, 'g', 'raw', 'main'),
          ingredient('carrotRaw', 'shredded carrot', 20, 'g', 'raw', 'main'),
          ingredient('soySauce', 'soy sauce', 10, 'g', 'unknown', 'sauce'),
        ],
      }),
      item(3, 'Vegan Spring Rolls with Vermicelli', {
        description:
          'Fresh rolls with tofu, lettuce, and cucumber over rice vermicelli.',
        price: 55000,
        tags: ['vegan', 'vegetarian'],
        imageUrl: seedImages.veganSpringRolls.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('tofuFirm', 'firm tofu', 100, 'g', 'cooked', 'main'),
          ingredient(
            'riceVermicelliCooked',
            'cooked rice vermicelli',
            150,
            'g',
            'cooked',
            'main',
          ),
          ingredient('lettuce', 'lettuce', 50, 'g', 'raw', 'main'),
          ingredient('cucumber', 'cucumber', 40, 'g', 'raw', 'main'),
          ingredient('soySauce', 'soy sauce', 15, 'g', 'unknown', 'sauce'),
        ],
      }),
    ],
  },
  {
    id: seedId(3, 2),
    ownerId: veganNutritionOwners[1].id,
    categoryId: seedId(4, 2),
    zoneId: seedId(5, 2),
    name: 'Harmony Eats',
    description: 'A mix of delicious traditional and plant-based dishes.',
    address: 'KTX Area A, VNU-HCM University Village, Di An, Binh Duong',
    phone: '0905602002',
    cuisineType: 'Mixed',
    logoUrl: seedImages.harmonyEatsLogo.secureUrl,
    coverImageUrl: seedImages.harmonyEatsCover.secureUrl,
    latitude: TARGET_LATITUDE - 0.0002,
    longitude: TARGET_LONGITUDE + 0.00025,
    categoryName: 'Mixed Menu',
    items: [
      item(4, 'Chicken Rice', {
        description:
          'Grilled chicken breast with steamed white rice, cucumber, and carrots.',
        price: 60000,
        tags: [],
        imageUrl: seedImages.chickenRice.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'chickenBreastGrilled',
            'grilled chicken breast',
            150,
            'g',
            'grilled',
            'main',
          ),
          ingredient(
            'whiteRiceCooked',
            'cooked white rice',
            180,
            'g',
            'cooked',
            'main',
          ),
          ingredient('cucumber', 'cucumber', 40, 'g', 'raw', 'main'),
          ingredient('carrotRaw', 'shredded carrot', 30, 'g', 'raw', 'main'),
          ingredient('soySauce', 'soy sauce', 10, 'g', 'unknown', 'sauce'),
        ],
      }),
      item(5, 'Grilled Pork Vermicelli', {
        description:
          'Grilled pork chop over vermicelli with lettuce and cucumber.',
        price: 65000,
        tags: [],
        imageUrl: seedImages.grilledPorkVermicelli.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'porkChopGrilled',
            'grilled pork chop',
            140,
            'g',
            'grilled',
            'main',
          ),
          ingredient(
            'riceVermicelliCooked',
            'cooked rice vermicelli',
            160,
            'g',
            'cooked',
            'main',
          ),
          ingredient('lettuce', 'lettuce', 45, 'g', 'raw', 'main'),
          ingredient('cucumber', 'cucumber', 40, 'g', 'raw', 'main'),
          ingredient('soySauce', 'soy sauce', 15, 'g', 'unknown', 'sauce'),
        ],
      }),
      item(6, 'Vegan Mushroom Pho', {
        description:
          'Vegan pho with rich mushroom broth, cooked mushrooms, and tofu.',
        price: 55000,
        tags: ['vegan', 'vegetarian'],
        imageUrl: seedImages.veganMushroomPho.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'mushroomCooked',
            'cooked mushroom',
            80,
            'g',
            'cooked',
            'main',
          ),
          ingredient('tofuFirm', 'firm tofu', 70, 'g', 'cooked', 'main'),
          ingredient(
            'riceVermicelliCooked',
            'cooked rice noodles',
            150,
            'g',
            'cooked',
            'main',
          ),
          ingredient('lettuce', 'lettuce', 30, 'g', 'raw', 'main'),
          ingredient('soySauce', 'soy sauce', 12, 'g', 'unknown', 'sauce'),
        ],
      }),
    ],
  },
];

const restaurantSeedNames = restaurantsData.map(
  (restaurant) => restaurant.name,
);

async function main() {
  console.log('Starting vegan nutrition seeding...');

  await cleanupExistingSeedData();
  await seedOwnerAccounts();
  await seedImageRecords();

  const foodIdsByKey = await seedNutritionFoodDatabase();

  for (const restaurant of restaurantsData) {
    await seedRestaurant(restaurant);
    await seedDeliveryZone(restaurant);
    await seedMenuCategory(restaurant);

    for (const menuItem of restaurant.items) {
      await seedMenuItem(restaurant, menuItem);
      await seedMenuItemNutrition(restaurant, menuItem, foodIdsByKey);
    }
  }

  console.log('Vegan nutrition seeding completed.');
  process.exit(0);
}

async function cleanupExistingSeedData() {
  console.log('Cleaning up existing vegan nutrition seed data...');

  const ownerIds = veganNutritionOwners.map((owner) => owner.id);
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
    const restaurantIds = existingRestaurants.map(
      (restaurant) => restaurant.id,
    );

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
        inArray(schema.orderingRestaurantSnapshots.restaurantId, restaurantIds),
      );
    await db
      .delete(schema.notificationRestaurantSnapshots)
      .where(
        inArray(
          schema.notificationRestaurantSnapshots.restaurantId,
          restaurantIds,
        ),
      );
    await db
      .delete(schema.restaurants)
      .where(inArray(schema.restaurants.id, restaurantIds));
  }

  await db
    .delete(schema.account)
    .where(inArray(schema.account.userId, ownerIds));
  await db.delete(schema.user).where(inArray(schema.user.id, ownerIds));
  await db.delete(schema.images).where(
    inArray(
      schema.images.publicId,
      veganNutritionImages.map((asset) => asset.publicId),
    ),
  );
}

async function seedOwnerAccounts() {
  const now = new Date();

  for (const owner of veganNutritionOwners) {
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
      `Seeded owner account: ${owner.email} / ${owner.password} for ${owner.restaurantName}`,
    );
  }
}

async function seedImageRecords() {
  await db.insert(schema.images).values(veganNutritionImages);
  console.log(`Seeded ${veganNutritionImages.length} image records.`);
}

async function seedNutritionFoodDatabase(): Promise<Map<string, string>> {
  const rows = await db
    .insert(schema.nutritionFoods)
    .values(
      nutritionFoodSeeds.map((food) => ({
        nameVi: food.nameVi,
        nameEn: food.nameEn,
        source: 'VEGAN_NUTRITION_SEED',
        sourceFoodId: nutritionFoodSourceId(food.key),
        aliases: buildAliases(food.nameVi, [food.nameEn, ...food.aliases]),
        category: food.category,
        state: food.state,
        calories100g: food.calories100g,
        protein100g: food.protein100g,
        carbs100g: food.carbs100g,
        fat100g: food.fat100g,
        fiber100g: food.fiber100g,
        sugar100g: food.sugar100g,
        sodium100g: food.sodium100g,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.nutritionFoods.nameVi, schema.nutritionFoods.state],
      set: {
        nameEn: sql`excluded.name_en`,
        source: sql`excluded.source`,
        sourceFoodId: sql`excluded.source_food_id`,
        aliases: sql`excluded.aliases`,
        category: sql`excluded.category`,
        calories100g: sql`excluded.calories_100g`,
        protein100g: sql`excluded.protein_100g`,
        carbs100g: sql`excluded.carbs_100g`,
        fat100g: sql`excluded.fat_100g`,
        fiber100g: sql`excluded.fiber_100g`,
        sugar100g: sql`excluded.sugar_100g`,
        sodium100g: sql`excluded.sodium_100g`,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: schema.nutritionFoods.id,
      sourceFoodId: schema.nutritionFoods.sourceFoodId,
    });

  const foodIdsByKey = new Map<string, string>();
  for (const row of rows) {
    const key = row.sourceFoodId?.replace('vegan-nutrition:', '');
    if (key) foodIdsByKey.set(key, row.id);
  }

  await seedNutritionFoodLocalizations(foodIdsByKey);
  console.log(`Seeded ${rows.length} nutrition food rows.`);

  return foodIdsByKey;
}

async function seedNutritionFoodLocalizations(
  foodIdsByKey: Map<string, string>,
) {
  const localizationRows = nutritionFoodSeeds.flatMap((food) => {
    const nutritionFoodId = foodIdsByKey.get(food.key);
    if (!nutritionFoodId) return [];

    return [
      {
        nutritionFoodId,
        locale: 'vi',
        name: food.nameVi,
        aliases: buildAliases(food.nameVi, food.aliases),
      },
      {
        nutritionFoodId,
        locale: 'en',
        name: food.nameEn,
        aliases: buildAliases(food.nameEn, food.aliases),
      },
    ];
  });

  if (localizationRows.length === 0) return;

  await db
    .insert(schema.nutritionFoodLocalizations)
    .values(localizationRows)
    .onConflictDoUpdate({
      target: [
        schema.nutritionFoodLocalizations.nutritionFoodId,
        schema.nutritionFoodLocalizations.locale,
      ],
      set: {
        name: sql`excluded.name`,
        aliases: sql`excluded.aliases`,
        updatedAt: new Date(),
      },
    });
}

async function seedRestaurant(restaurant: RestaurantSeed) {
  await db.insert(schema.restaurants).values({
    id: restaurant.id,
    ownerId: restaurant.ownerId,
    name: restaurant.name,
    description: restaurant.description,
    address: restaurant.address,
    phone: restaurant.phone,
    isOpen: true,
    isApproved: true,
    cuisineType: restaurant.cuisineType,
    logoUrl: restaurant.logoUrl,
    coverImageUrl: restaurant.coverImageUrl,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
  });

  await db.insert(schema.orderingRestaurantSnapshots).values({
    restaurantId: restaurant.id,
    name: restaurant.name,
    isOpen: true,
    isApproved: true,
    address: restaurant.address,
    cuisineType: restaurant.cuisineType,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    ownerId: restaurant.ownerId,
  });

  await db.insert(schema.notificationRestaurantSnapshots).values({
    restaurantId: restaurant.id,
    ownerId: restaurant.ownerId,
    name: restaurant.name,
  });

  console.log(`Seeded restaurant: ${restaurant.name}`);
}

async function seedDeliveryZone(restaurant: RestaurantSeed) {
  const zone = {
    id: restaurant.zoneId,
    restaurantId: restaurant.id,
    name: `${restaurant.name} Delivery Zone`,
    radiusKm: 5,
    baseFee: 15000,
    perKmRate: 4000,
    avgSpeedKmh: 30,
    prepTimeMinutes: 15,
    bufferMinutes: 5,
    isActive: true,
  };

  await db.insert(schema.deliveryZones).values(zone);
  await db.insert(schema.orderingDeliveryZoneSnapshots).values({
    zoneId: zone.id,
    restaurantId: zone.restaurantId,
    name: zone.name,
    radiusKm: zone.radiusKm,
    baseFee: zone.baseFee,
    perKmRate: zone.perKmRate,
    avgSpeedKmh: zone.avgSpeedKmh,
    prepTimeMinutes: zone.prepTimeMinutes,
    bufferMinutes: zone.bufferMinutes,
    isActive: zone.isActive,
    isDeleted: false,
  });
}

async function seedMenuCategory(restaurant: RestaurantSeed) {
  await db.insert(schema.menuCategories).values({
    id: restaurant.categoryId,
    restaurantId: restaurant.id,
    name: restaurant.categoryName,
    displayOrder: 1,
  });
}

async function seedMenuItem(
  restaurant: RestaurantSeed,
  menuItem: MenuItemSeed,
) {
  await db.insert(schema.menuItems).values({
    id: menuItem.id,
    restaurantId: restaurant.id,
    categoryId: restaurant.categoryId,
    name: menuItem.name,
    description: menuItem.description,
    price: menuItem.price,
    status: 'available',
    tags: menuItem.tags,
    imageUrl: menuItem.imageUrl,
  });

  await db.insert(schema.orderingMenuItemSnapshots).values({
    menuItemId: menuItem.id,
    restaurantId: restaurant.id,
    name: menuItem.name,
    price: menuItem.price,
    status: 'available',
    modifiers: [],
  });
}

async function seedMenuItemNutrition(
  restaurant: RestaurantSeed,
  menuItem: MenuItemSeed,
  foodIdsByKey: Map<string, string>,
) {
  const recipe = buildExtractedRecipe(menuItem);
  const nutrition = calculateNutrition(menuItem);

  await db.insert(schema.nutritionAnalysisSessions).values({
    id: menuItem.analysisSessionId,
    menuItemId: menuItem.id,
    restaurantId: restaurant.id,
    inputType: 'text',
    rawRecipeText: buildRecipeText(menuItem),
    aiExtractedJson: recipe,
    status: 'SAVED',
  });

  await db.insert(schema.nutritionAnalysisIngredients).values(
    menuItem.ingredients.map((ingredientSeed) => ({
      analysisSessionId: menuItem.analysisSessionId,
      rawText: buildIngredientRawText(ingredientSeed),
      extractedName: ingredientSeed.name,
      correctedName: ingredientSeed.name,
      quantity: ingredientSeed.quantity,
      unit: ingredientSeed.unit,
      quantityGram: ingredientSeed.quantityGram,
      matchedNutritionFoodId: requireFoodId(
        foodIdsByKey,
        ingredientSeed.foodKey,
      ),
      confidence: 1,
      requiresConfirmation: false,
      notes: [],
    })),
  );

  await db
    .insert(schema.menuItemNutrition)
    .values({
      menuItemId: menuItem.id,
      servings: menuItem.servings,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      fiber: nutrition.fiber,
      sugar: nutrition.sugar,
      sodium: nutrition.sodium,
      source: 'VERIFIED_BY_RESTAURANT',
      verifiedByRestaurant: true,
    })
    .onConflictDoUpdate({
      target: schema.menuItemNutrition.menuItemId,
      set: {
        servings: menuItem.servings,
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        fiber: nutrition.fiber,
        sugar: nutrition.sugar,
        sodium: nutrition.sodium,
        source: 'VERIFIED_BY_RESTAURANT',
        verifiedByRestaurant: true,
        updatedAt: new Date(),
      },
    });
}

function nutritionFood(
  key: string,
  nameVi: string,
  nameEn: string,
  details: Omit<NutritionFoodSeed, 'key' | 'nameVi' | 'nameEn'>,
): NutritionFoodSeed {
  return {
    key,
    nameVi,
    nameEn,
    ...details,
  };
}

function item(
  index: number,
  name: string,
  details: Omit<MenuItemSeed, 'id' | 'analysisSessionId' | 'name'>,
): MenuItemSeed {
  return {
    id: seedId(6, index),
    analysisSessionId: seedId(7, index),
    name,
    ...details,
  };
}

function ingredient(
  foodKey: string,
  name: string,
  quantityGram: number,
  unit: NutritionUnit,
  preparation: PreparationState,
  category: IngredientCategory,
): RecipeIngredientSeed {
  return {
    foodKey,
    name,
    canonicalNameEn: nutritionFoodByKey(foodKey).nameEn,
    quantity: quantityGram,
    unit,
    quantityGram,
    preparation,
    category,
  };
}

function nutritionFoodByKey(key: string): NutritionFoodSeed {
  const food = nutritionFoodSeeds.find((candidate) => candidate.key === key);
  if (!food) throw new Error(`Missing nutrition food seed for key: ${key}`);
  return food;
}

function nutritionFoodSourceId(key: string): string {
  return `vegan-nutrition:${key}`;
}

function requireFoodId(foodIdsByKey: Map<string, string>, key: string): string {
  const id = foodIdsByKey.get(key);
  if (!id) throw new Error(`Missing nutrition food id for key: ${key}`);
  return id;
}

function calculateNutrition(menuItem: MenuItemSeed): NutritionAmount {
  const total = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  };

  for (const ingredientSeed of menuItem.ingredients) {
    const food = nutritionFoodByKey(ingredientSeed.foodKey);
    const factor = ingredientSeed.quantityGram / 100;

    total.calories += food.calories100g * factor;
    total.protein += food.protein100g * factor;
    total.carbs += food.carbs100g * factor;
    total.fat += food.fat100g * factor;
    total.fiber += food.fiber100g * factor;
    total.sugar += food.sugar100g * factor;
    total.sodium += food.sodium100g * factor;
  }

  return roundNutritionAmount({
    calories: total.calories / menuItem.servings,
    protein: total.protein / menuItem.servings,
    carbs: total.carbs / menuItem.servings,
    fat: total.fat / menuItem.servings,
    fiber: total.fiber / menuItem.servings,
    sugar: total.sugar / menuItem.servings,
    sodium: total.sodium / menuItem.servings,
  });
}

function roundNutritionAmount(amount: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}): NutritionAmount {
  return {
    calories: Math.round(amount.calories),
    protein: roundMacro(amount.protein),
    carbs: roundMacro(amount.carbs),
    fat: roundMacro(amount.fat),
    fiber: roundMacro(amount.fiber),
    sugar: roundMacro(amount.sugar),
    sodium: Math.round(amount.sodium),
  };
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildExtractedRecipe(menuItem: MenuItemSeed): ExtractedRecipe {
  return {
    recipeName: menuItem.name,
    servings: menuItem.servings,
    ingredients: menuItem.ingredients.map((ingredientSeed) => ({
      rawText: buildIngredientRawText(ingredientSeed),
      name: ingredientSeed.name,
      canonicalNameEn: ingredientSeed.canonicalNameEn,
      canonicalNameConfidence: 1,
      quantity: ingredientSeed.quantity,
      unit: ingredientSeed.unit,
      preparation: ingredientSeed.preparation,
      category: ingredientSeed.category,
      confidence: 1,
      requiresConfirmation: false,
      notes: [],
    })),
    warnings: [],
  };
}

function buildRecipeText(menuItem: MenuItemSeed): string {
  return [
    `${menuItem.name} (${menuItem.servings} serving)`,
    ...menuItem.ingredients.map(buildIngredientRawText),
  ].join('\n');
}

function buildIngredientRawText(ingredientSeed: RecipeIngredientSeed): string {
  return `${ingredientSeed.quantity} ${ingredientSeed.unit} ${ingredientSeed.name}`;
}

function buildAliases(name: string, aliases: readonly string[]): string[] {
  const values = new Set<string>();

  for (const value of [name, ...aliases]) {
    const cleaned = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (cleaned.length >= 2) values.add(cleaned);
  }

  return Array.from(values).slice(0, 16);
}

main().catch((error) => {
  console.error('Vegan nutrition seed failed:', error);
  process.exit(1);
});
