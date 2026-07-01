import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
export const db = drizzle(pool, { schema });

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { inArray, or, sql } from 'drizzle-orm';

import type {
  ExtractedRecipe,
  IngredientCategory,
  NutritionAmount,
  NutritionUnit,
  PreparationState,
} from '../../nutrition/types/nutrition.types';
import { dietaryTagSlugs, type DietaryTagSlug } from './dietary-tags.data';

import { uploadSeedImages, type SeedImageDef } from './cloudinary-uploader';

type SeedImageWithPlaceholder = SeedImageDef & { secureUrl: string };

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

type ModifierOptionSeed = {
  name: string;
  price: number;
  isDefault?: boolean;
};

type ModifierGroupSeed = {
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ModifierOptionSeed[];
};

type MenuItemSeed = {
  id: string;
  analysisSessionId: string;
  name: string;
  description: string;
  price: number;
  itemKind: 'food' | 'beverage' | 'mixed';
  tags: DietaryTagSlug[];
  imageUrl: string;
  servings: number;
  ingredients: RecipeIngredientSeed[];
  modifiers?: ModifierGroupSeed[];
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
): SeedImageWithPlaceholder => ({
  publicId,
  sourceUrl:
    remoteImageId.endsWith('.jpg') ||
    remoteImageId.endsWith('.png') ||
    remoteImageId.startsWith('http')
      ? remoteImageId
      : `https://images.unsplash.com/${remoteImageId}`,
  secureUrl: `__UPLOAD_PENDING__:${publicId}`,
  width,
  height,
});

const seedImages = {
  coffeeLogo: image(
    'beverage-restaurants/restaurants/coffee-logo',
    'photo-1497935586351-b67a49e012bf',
    512,
    512,
  ),
  coffeeCover: image(
    'beverage-restaurants/restaurants/coffee-cover',
    'photo-1554118811-1e0d58224f24',
  ),
  bobaLogo: image(
    'beverage-restaurants/restaurants/boba-logo',
    'photo-1558160074-4d7d4bdef064',
    512,
    512,
  ),
  bobaCover: image(
    'beverage-restaurants/restaurants/boba-cover',
    'photo-1556881286-fc6915169721',
  ),
  blackCoffee: image(
    'beverage-restaurants/menu/black-coffee',
    path.join(__dirname, 'images', 'black_coffee_1782359904893.jpg'),
  ),
  milkCoffee: image(
    'beverage-restaurants/menu/milk-coffee',
    path.join(__dirname, 'images', 'milk_coffee_1782359915415.jpg'),
  ),
  classicMilkTea: image(
    'beverage-restaurants/menu/classic-milk-tea',
    path.join(__dirname, 'images', 'classic_milk_tea_1782359925188.jpg'),
  ),
  bobaMilkTea: image(
    'beverage-restaurants/menu/boba-milk-tea',
    path.join(__dirname, 'images', 'boba_milk_tea_1782359935009.jpg'),
  ),
  orangeJuice: image(
    'beverage-restaurants/menu/orange-juice',
    path.join(__dirname, 'images', 'orange_juice_1782359946447.jpg'),
  ),
} satisfies Record<string, SeedImageWithPlaceholder>;

// unused

function seedId(group: number, index: number): string {
  return `570000${group.toString().padStart(2, '0')}-0000-4000-8000-${index
    .toString()
    .padStart(12, '0')}`;
}

const beverageOwners = [
  {
    id: seedId(1, 1),
    accountId: seedId(2, 1),
    name: 'VNU Coffee Owner',
    email: 'vnu-coffee-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'VNU Coffee Roasters',
  },
  {
    id: seedId(1, 2),
    accountId: seedId(2, 2),
    name: 'Boba Corner Owner',
    email: 'boba-corner-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'Boba Corner KTX',
  },
];

const nutritionFoodSeeds: NutritionFoodSeed[] = [
  nutritionFood('blackCoffee', 'ca phe den', 'black coffee', {
    aliases: ['coffee', 'ca phe'],
    category: 'beverage',
    state: 'cooked',
    calories100g: 2,
    protein100g: 0.1,
    carbs100g: 0,
    fat100g: 0,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 2,
  }),
  nutritionFood('milkWhole', 'sua tuoi nguyen kem', 'whole milk', {
    aliases: ['milk', 'sua tuoi'],
    category: 'dairy',
    state: 'unknown',
    calories100g: 61,
    protein100g: 3.2,
    carbs100g: 4.8,
    fat100g: 3.3,
    fiber100g: 0,
    sugar100g: 4.8,
    sodium100g: 43,
  }),
  nutritionFood('sugarWhite', 'duong trang', 'white sugar', {
    aliases: ['sugar', 'duong'],
    category: 'sweetener',
    state: 'unknown',
    calories100g: 387,
    protein100g: 0,
    carbs100g: 100,
    fat100g: 0,
    fiber100g: 0,
    sugar100g: 100,
    sodium100g: 1,
  }),
  nutritionFood('condensedMilk', 'sua dac', 'sweetened condensed milk', {
    aliases: ['condensed milk', 'sua dac co duong'],
    category: 'dairy',
    state: 'unknown',
    calories100g: 321,
    protein100g: 7.9,
    carbs100g: 54.4,
    fat100g: 8.7,
    fiber100g: 0,
    sugar100g: 54.4,
    sodium100g: 127,
  }),
  nutritionFood('blackTea', 'tra den', 'black tea', {
    aliases: ['tea', 'tra'],
    category: 'beverage',
    state: 'cooked',
    calories100g: 1,
    protein100g: 0,
    carbs100g: 0.3,
    fat100g: 0,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 3,
  }),
  nutritionFood('bobaPearls', 'tran chau', 'tapioca pearls', {
    aliases: ['boba', 'tapioca'],
    category: 'grain',
    state: 'cooked',
    calories100g: 358,
    protein100g: 0.2,
    carbs100g: 88,
    fat100g: 0,
    fiber100g: 0.9,
    sugar100g: 3.3,
    sodium100g: 1,
  }),
  nutritionFood('orangeJuice', 'nuoc cam vat', 'orange juice', {
    aliases: ['orange juice', 'nuoc cam'],
    category: 'beverage',
    state: 'raw',
    calories100g: 45,
    protein100g: 0.7,
    carbs100g: 10.4,
    fat100g: 0.2,
    fiber100g: 0.2,
    sugar100g: 8.4,
    sodium100g: 1,
  }),
];

const restaurantsData: RestaurantSeed[] = [
  {
    id: seedId(3, 1),
    ownerId: beverageOwners[0].id,
    categoryId: seedId(4, 1),
    zoneId: seedId(5, 1),
    name: 'VNU Coffee Roasters',
    description: 'Specialty coffee near VNU.',
    address: 'Internal Road, VNU-HCM University Village',
    phone: '0905601101',
    cuisineType: 'Cafe',
    logoUrl: seedImages.coffeeLogo.secureUrl,
    coverImageUrl: seedImages.coffeeCover.secureUrl,
    latitude: TARGET_LATITUDE + 0.0001,
    longitude: TARGET_LONGITUDE - 0.0001,
    categoryName: 'Coffee & Drinks',
    items: [
      item(1, 'Vietnamese Black Coffee', {
        description: 'Strong black coffee with sugar and ice.',
        price: 25000,
        itemKind: 'beverage',
        tags: [dietaryTagSlugs.vegan],
        imageUrl: seedImages.blackCoffee.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('blackCoffee', 'black coffee', 150, 'g', 'cooked', 'main'),
          ingredient('sugarWhite', 'white sugar', 15, 'g', 'unknown', 'sauce'),
        ],
        modifiers: [
          {
            name: 'Size',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Medium', price: 0, isDefault: true },
              { name: 'Large', price: 5000 },
            ],
          },
          {
            name: 'Ice Level',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Normal Ice', price: 0, isDefault: true },
              { name: 'Less Ice', price: 0 },
              { name: 'No Ice', price: 0 },
            ],
          },
          {
            name: 'Add-ons',
            minSelections: 0,
            maxSelections: 2,
            options: [
              { name: 'Extra Shot', price: 10000 },
              { name: 'Extra Sugar', price: 0 },
            ],
          },
        ],
      }),
      item(2, 'Vietnamese Milk Coffee', {
        description: 'Classic iced coffee with sweetened condensed milk.',
        price: 29000,
        itemKind: 'beverage',
        tags: [],
        imageUrl: seedImages.milkCoffee.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('blackCoffee', 'black coffee', 100, 'g', 'cooked', 'main'),
          ingredient(
            'condensedMilk',
            'sweetened condensed milk',
            40,
            'g',
            'unknown',
            'main',
          ),
        ],
        modifiers: [
          {
            name: 'Size',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Medium', price: 0, isDefault: true },
              { name: 'Large', price: 7000 },
            ],
          },
          {
            name: 'Ice Level',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Normal Ice', price: 0, isDefault: true },
              { name: 'Less Ice', price: 0 },
            ],
          },
          {
            name: 'Add-ons',
            minSelections: 0,
            maxSelections: 2,
            options: [
              { name: 'Extra Milk', price: 5000 },
              { name: 'Extra Shot', price: 10000 },
            ],
          },
        ],
      }),
    ],
  },
  {
    id: seedId(3, 2),
    ownerId: beverageOwners[1].id,
    categoryId: seedId(4, 2),
    zoneId: seedId(5, 2),
    name: 'Boba Corner KTX',
    description: 'Refreshing milk tea for students.',
    address: 'KTX Area B, VNU-HCM University Village',
    phone: '0905601102',
    cuisineType: 'Milk Tea',
    logoUrl: seedImages.bobaLogo.secureUrl,
    coverImageUrl: seedImages.bobaCover.secureUrl,
    latitude: TARGET_LATITUDE - 0.0002,
    longitude: TARGET_LONGITUDE + 0.0003,
    categoryName: 'Milk Tea',
    items: [
      item(3, 'Classic Milk Tea', {
        description: 'Traditional black milk tea.',
        price: 35000,
        itemKind: 'beverage',
        tags: [],
        imageUrl: seedImages.classicMilkTea.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('blackTea', 'black tea', 200, 'g', 'cooked', 'main'),
          ingredient('milkWhole', 'whole milk', 50, 'g', 'unknown', 'main'),
          ingredient('sugarWhite', 'white sugar', 20, 'g', 'unknown', 'sauce'),
        ],
        modifiers: [
          {
            name: 'Size',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Medium', price: 0, isDefault: true },
              { name: 'Large', price: 8000 },
            ],
          },
          {
            name: 'Sugar Level',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: '100% Sugar', price: 0, isDefault: true },
              { name: '50% Sugar', price: 0 },
              { name: 'No Sugar', price: 0 },
            ],
          },
          {
            name: 'Toppings',
            minSelections: 0,
            maxSelections: 3,
            options: [
              { name: 'Boba Pearls', price: 5000 },
              { name: 'Aloe Vera', price: 6000 },
              { name: 'Pudding', price: 7000 },
            ],
          },
        ],
      }),
      item(4, 'Boba Milk Tea', {
        description: 'Classic milk tea with tapioca pearls.',
        price: 45000,
        itemKind: 'beverage',
        tags: [],
        imageUrl: seedImages.bobaMilkTea.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('blackTea', 'black tea', 180, 'g', 'cooked', 'main'),
          ingredient('milkWhole', 'whole milk', 50, 'g', 'unknown', 'main'),
          ingredient('bobaPearls', 'tapioca pearls', 50, 'g', 'cooked', 'main'),
          ingredient('sugarWhite', 'white sugar', 20, 'g', 'unknown', 'sauce'),
        ],
        modifiers: [
          {
            name: 'Size',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Medium', price: 0, isDefault: true },
              { name: 'Large', price: 8000 },
            ],
          },
          {
            name: 'Sugar Level',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: '100% Sugar', price: 0, isDefault: true },
              { name: '50% Sugar', price: 0 },
              { name: 'No Sugar', price: 0 },
            ],
          },
          {
            name: 'Toppings',
            minSelections: 0,
            maxSelections: 3,
            options: [
              { name: 'Extra Boba Pearls', price: 5000 },
              { name: 'Cheese Foam', price: 12000 },
            ],
          },
        ],
      }),
      item(5, 'Fresh Orange Juice', {
        description: 'Freshly squeezed orange juice.',
        price: 30000,
        itemKind: 'beverage',
        tags: [dietaryTagSlugs.vegan],
        imageUrl: seedImages.orangeJuice.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('orangeJuice', 'orange juice', 250, 'g', 'raw', 'main'),
          ingredient('sugarWhite', 'white sugar', 10, 'g', 'unknown', 'sauce'),
        ],
        modifiers: [
          {
            name: 'Size',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Medium', price: 0, isDefault: true },
              { name: 'Large', price: 10000 },
            ],
          },
          {
            name: 'Ice Level',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Normal Ice', price: 0, isDefault: true },
              { name: 'Less Ice', price: 0 },
            ],
          },
        ],
      }),
    ],
  },
];

const restaurantSeedNames = restaurantsData.map((r) => r.name);

async function main() {
  console.log('Starting beverage restaurants seeding...');

  await cleanupExistingSeedData();

  const uploadedImagesMap = await uploadSeedImages(Object.values(seedImages));

  for (const restaurant of restaurantsData) {
    restaurant.logoUrl =
      uploadedImagesMap.get(
        restaurant.logoUrl.replace('__UPLOAD_PENDING__:', ''),
      )?.secureUrl || restaurant.logoUrl;
    restaurant.coverImageUrl =
      uploadedImagesMap.get(
        restaurant.coverImageUrl.replace('__UPLOAD_PENDING__:', ''),
      )?.secureUrl || restaurant.coverImageUrl;
    for (const item of restaurant.items) {
      item.imageUrl =
        uploadedImagesMap.get(item.imageUrl.replace('__UPLOAD_PENDING__:', ''))
          ?.secureUrl || item.imageUrl;
    }
  }

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

  console.log('Beverage restaurants seeding completed.');
  await pool.end();
  process.exit(0);
}

async function cleanupExistingSeedData() {
  console.log('Cleaning up existing beverage seed data...');

  const ownerIds = beverageOwners.map((owner) => owner.id);
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
      .delete(schema.restaurants)
      .where(inArray(schema.restaurants.id, restaurantIds));
  }
}

async function seedNutritionFoodDatabase(): Promise<Map<string, string>> {
  const rows = await db
    .insert(schema.nutritionFoods)
    .values(
      nutritionFoodSeeds.map((food) => ({
        nameVi: food.nameVi,
        nameEn: food.nameEn,
        source: 'BEVERAGE_RESTAURANTS_SEED',
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
    const key = row.sourceFoodId?.replace('beverage-restaurants:', '');
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

  console.log(`Seeded restaurant: ${restaurant.name}`);
}

async function seedDeliveryZone(restaurant: RestaurantSeed) {
  const zone = {
    id: restaurant.zoneId,
    restaurantId: restaurant.id,
    name: 'VNU-HCM University Village delivery zone',
    radiusKm: 4,
    baseFee: 10000,
    perKmRate: 3500,
    avgSpeedKmh: 25,
    prepTimeMinutes: 10,
    bufferMinutes: 5,
    isActive: true,
  };

  await db.insert(schema.deliveryZones).values(zone);
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
    itemKind: menuItem.itemKind,
    tags: menuItem.tags,
    imageUrl: menuItem.imageUrl,
  });

  // unused

  if (menuItem.modifiers && menuItem.modifiers.length > 0) {
    let groupDisplayOrder = 0;
    for (const group of menuItem.modifiers) {
      const groupId = randomUUID();
      await db.insert(schema.modifierGroups).values({
        id: groupId,
        menuItemId: menuItem.id,
        name: group.name,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        displayOrder: groupDisplayOrder++,
      });

      // unused
      let optionDisplayOrder = 0;
      for (const option of group.options) {
        const optionId = randomUUID();
        await db.insert(schema.modifierOptions).values({
          id: optionId,
          groupId: groupId,
          name: option.name,
          price: option.price,
          isDefault: option.isDefault ?? false,
          isAvailable: true,
          displayOrder: optionDisplayOrder++,
        });
      }
    }
  }
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
  return { key, nameVi, nameEn, ...details };
}

function item(
  index: number,
  name: string,
  details: Omit<
    MenuItemSeed,
    'id' | 'analysisSessionId' | 'name' | 'itemKind'
  > & {
    itemKind?: 'food' | 'beverage' | 'mixed';
  },
): MenuItemSeed {
  return {
    id: seedId(6, index),
    analysisSessionId: seedId(7, index),
    name,
    itemKind: details.itemKind ?? 'food',
    modifiers: details.modifiers ?? [],
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
  return `beverage-restaurants:${key}`;
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

main().catch(async (error) => {
  console.error('Beverage restaurants seed failed:', error);
  await pool.end();
  process.exit(1);
});
