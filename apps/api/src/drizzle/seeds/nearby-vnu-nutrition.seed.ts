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
 * Nearby VNU nutrition seed.
 *
 * Adds three restaurants near:
 *   latitude: 10.8928
 *   longitude: 106.7915
 *
 * Each restaurant has its own restaurant-owner account and more than three
 * menu items. Every menu item gets:
 *   - a persisted recipe analysis session
 *   - persisted nutrition_analysis_ingredients rows
 *   - calculated, restaurant-verified menu_item_nutrition values
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
  freshBowlLogo: image(
    'nearby-vnu-nutrition/restaurants/fresh-bowl-logo',
    'photo-1512621776951-a57141f2eefd',
    512,
    512,
  ),
  freshBowlCover: image(
    'nearby-vnu-nutrition/restaurants/fresh-bowl-cover',
    'photo-1546069901-ba9599a7e63c',
  ),
  grillLabLogo: image(
    'nearby-vnu-nutrition/restaurants/grill-lab-logo',
    'photo-1529193591184-b1d58069ecdd',
    512,
    512,
  ),
  grillLabCover: image(
    'nearby-vnu-nutrition/restaurants/grill-lab-cover',
    'photo-1544025162-d76694265947',
  ),
  morningMarketLogo: image(
    'nearby-vnu-nutrition/restaurants/morning-market-logo',
    'photo-1495474472287-4d71bcdd2085',
    512,
    512,
  ),
  morningMarketCover: image(
    'nearby-vnu-nutrition/restaurants/morning-market-cover',
    'photo-1498837167922-ddd27525d352',
  ),
  chickenRiceBowl: image(
    'nearby-vnu-nutrition/menu/chicken-rice-bowl',
    'photo-1562967916-eb82221dfb92',
  ),
  tofuBrownRiceBowl: image(
    'nearby-vnu-nutrition/menu/tofu-brown-rice-bowl',
    'photo-1512621776951-a57141f2eefd',
  ),
  shrimpVermicelliSalad: image(
    'nearby-vnu-nutrition/menu/shrimp-vermicelli-salad',
    'photo-1569718212165-3a8278d5f624',
  ),
  beefPhoProteinBowl: image(
    'nearby-vnu-nutrition/menu/beef-pho-protein-bowl',
    'photo-1582878826629-29b7ad1cdc43',
  ),
  honeyPorkChopRice: image(
    'nearby-vnu-nutrition/menu/honey-pork-chop-rice',
    'photo-1544025162-d76694265947',
  ),
  grilledChickenBanhMi: image(
    'nearby-vnu-nutrition/menu/grilled-chicken-banh-mi',
    'photo-1509722747041-616f39b57569',
  ),
  beefSkewerVermicelli: image(
    'nearby-vnu-nutrition/menu/beef-skewer-vermicelli',
    'photo-1559847844-5315695dadae',
  ),
  salmonRicePlate: image(
    'nearby-vnu-nutrition/menu/salmon-rice-plate',
    'photo-1467003909585-2f8a72700288',
  ),
  eggAvocadoToast: image(
    'nearby-vnu-nutrition/menu/egg-avocado-toast',
    'photo-1525351484163-7529414344d8',
  ),
  tunaBrownRiceSalad: image(
    'nearby-vnu-nutrition/menu/tuna-brown-rice-salad',
    'photo-1546069901-ba9599a7e63c',
  ),
  yogurtFruitGranola: image(
    'nearby-vnu-nutrition/menu/yogurt-fruit-granola',
    'photo-1488477181946-6428a0291777',
  ),
  chickenPorridgeBowl: image(
    'nearby-vnu-nutrition/menu/chicken-porridge-bowl',
    'photo-1547592180-85f173990554',
  ),
} satisfies Record<string, SeedImage>;

const nearbyVnuNutritionImages = Object.values(seedImages);

function seedId(group: number, index: number): string {
  return `560000${group.toString().padStart(2, '0')}-0000-4000-8000-${index
    .toString()
    .padStart(12, '0')}`;
}

const nearbyVnuNutritionOwners = [
  {
    id: seedId(1, 1),
    accountId: seedId(2, 1),
    name: 'Fresh Bowl VNU Owner',
    email: 'fresh-bowl-vnu-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'Fresh Bowl VNU',
  },
  {
    id: seedId(1, 2),
    accountId: seedId(2, 2),
    name: 'Grill Lab KTX Owner',
    email: 'grill-lab-ktx-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'Grill Lab KTX',
  },
  {
    id: seedId(1, 3),
    accountId: seedId(2, 3),
    name: 'Morning Market Cafe Owner',
    email: 'morning-market-cafe-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'Morning Market Cafe',
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
  nutritionFood('brownRiceCooked', 'gao lut nau chin', 'cooked brown rice', {
    aliases: ['brown rice', 'com gao lut'],
    category: 'grain',
    state: 'cooked',
    calories100g: 123,
    protein100g: 2.7,
    carbs100g: 25.6,
    fat100g: 1,
    fiber100g: 1.8,
    sugar100g: 0.2,
    sodium100g: 4,
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
  nutritionFood('ricePorridge', 'chao trang', 'plain rice porridge', {
    aliases: ['rice porridge', 'congee', 'chao'],
    category: 'grain',
    state: 'cooked',
    calories100g: 49,
    protein100g: 1,
    carbs100g: 10.6,
    fat100g: 0.2,
    fiber100g: 0.2,
    sugar100g: 0.1,
    sodium100g: 4,
  }),
  nutritionFood('wholeWheatBread', 'banh mi nguyen cam', 'whole wheat bread', {
    aliases: ['whole wheat toast', 'brown bread'],
    category: 'grain',
    state: 'cooked',
    calories100g: 247,
    protein100g: 13,
    carbs100g: 41,
    fat100g: 4.2,
    fiber100g: 7,
    sugar100g: 6,
    sodium100g: 400,
  }),
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
  nutritionFood('granola', 'ngu coc granola', 'granola', {
    aliases: ['oat granola', 'breakfast granola'],
    category: 'grain',
    state: 'cooked',
    calories100g: 471,
    protein100g: 10,
    carbs100g: 64,
    fat100g: 20,
    fiber100g: 8,
    sugar100g: 24,
    sodium100g: 180,
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
  nutritionFood('shrimpCooked', 'tom hap', 'cooked shrimp', {
    aliases: ['shrimp', 'prawn', 'tom'],
    category: 'protein',
    state: 'cooked',
    calories100g: 99,
    protein100g: 24,
    carbs100g: 0.2,
    fat100g: 0.3,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 111,
  }),
  nutritionFood('beefLeanGrilled', 'bo nac nuong', 'grilled lean beef', {
    aliases: ['lean beef', 'grilled beef', 'beef'],
    category: 'protein',
    state: 'grilled',
    calories100g: 217,
    protein100g: 26,
    carbs100g: 0,
    fat100g: 12,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 72,
  }),
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
  nutritionFood('salmonGrilled', 'ca hoi nuong', 'grilled salmon', {
    aliases: ['salmon', 'ca hoi'],
    category: 'protein',
    state: 'grilled',
    calories100g: 206,
    protein100g: 22,
    carbs100g: 0,
    fat100g: 12,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 59,
  }),
  nutritionFood('tunaCanned', 'ca ngu dong hop', 'canned tuna in water', {
    aliases: ['tuna', 'canned tuna'],
    category: 'protein',
    state: 'cooked',
    calories100g: 116,
    protein100g: 26,
    carbs100g: 0,
    fat100g: 0.8,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 338,
  }),
  nutritionFood('eggBoiled', 'trung ga luoc', 'boiled chicken egg', {
    aliases: ['egg', 'boiled egg', 'chicken egg'],
    category: 'protein',
    state: 'boiled',
    calories100g: 155,
    protein100g: 13,
    carbs100g: 1.1,
    fat100g: 11,
    fiber100g: 0,
    sugar100g: 1.1,
    sodium100g: 124,
  }),
  nutritionFood('greekYogurt', 'sua chua hy lap', 'plain Greek yogurt', {
    aliases: ['greek yogurt', 'plain yogurt'],
    category: 'dairy',
    state: 'unknown',
    calories100g: 73,
    protein100g: 9.9,
    carbs100g: 3.9,
    fat100g: 1.9,
    fiber100g: 0,
    sugar100g: 3.6,
    sodium100g: 34,
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
  nutritionFood('tomato', 'ca chua', 'tomato', {
    aliases: ['fresh tomato'],
    category: 'vegetable',
    state: 'raw',
    calories100g: 18,
    protein100g: 0.9,
    carbs100g: 3.9,
    fat100g: 0.2,
    fiber100g: 1.2,
    sugar100g: 2.6,
    sodium100g: 5,
  }),
  nutritionFood('avocado', 'bo trai', 'avocado', {
    aliases: ['fresh avocado'],
    category: 'fruit',
    state: 'raw',
    calories100g: 160,
    protein100g: 2,
    carbs100g: 8.5,
    fat100g: 14.7,
    fiber100g: 6.7,
    sugar100g: 0.7,
    sodium100g: 7,
  }),
  nutritionFood('banana', 'chuoi', 'banana', {
    aliases: ['fresh banana'],
    category: 'fruit',
    state: 'raw',
    calories100g: 89,
    protein100g: 1.1,
    carbs100g: 22.8,
    fat100g: 0.3,
    fiber100g: 2.6,
    sugar100g: 12.2,
    sodium100g: 1,
  }),
  nutritionFood('mango', 'xoai', 'mango', {
    aliases: ['fresh mango'],
    category: 'fruit',
    state: 'raw',
    calories100g: 60,
    protein100g: 0.8,
    carbs100g: 15,
    fat100g: 0.4,
    fiber100g: 1.6,
    sugar100g: 13.7,
    sodium100g: 1,
  }),
  nutritionFood('freshHerbs', 'rau thom', 'mixed fresh herbs', {
    aliases: ['vietnamese herbs', 'mint', 'cilantro', 'rau song'],
    category: 'herb',
    state: 'raw',
    calories100g: 30,
    protein100g: 3,
    carbs100g: 5,
    fat100g: 0.7,
    fiber100g: 3.5,
    sugar100g: 1,
    sodium100g: 30,
  }),
  nutritionFood('peanuts', 'dau phong rang', 'roasted peanuts', {
    aliases: ['peanuts', 'crushed peanuts'],
    category: 'nut',
    state: 'cooked',
    calories100g: 567,
    protein100g: 25.8,
    carbs100g: 16.1,
    fat100g: 49.2,
    fiber100g: 8.5,
    sugar100g: 4.7,
    sodium100g: 18,
  }),
  nutritionFood('oliveOil', 'dau olive', 'olive oil', {
    aliases: ['olive oil', 'cooking oil'],
    category: 'fat',
    state: 'unknown',
    calories100g: 884,
    protein100g: 0,
    carbs100g: 0,
    fat100g: 100,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 0,
  }),
  nutritionFood('sesameOil', 'dau me', 'sesame oil', {
    aliases: ['sesame oil'],
    category: 'fat',
    state: 'unknown',
    calories100g: 884,
    protein100g: 0,
    carbs100g: 0,
    fat100g: 100,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 0,
  }),
  nutritionFood('honey', 'mat ong', 'honey', {
    aliases: ['honey'],
    category: 'sweetener',
    state: 'unknown',
    calories100g: 304,
    protein100g: 0.3,
    carbs100g: 82.4,
    fat100g: 0,
    fiber100g: 0,
    sugar100g: 82.1,
    sodium100g: 4,
  }),
  nutritionFood('fishSauce', 'nuoc mam', 'fish sauce', {
    aliases: ['fish sauce'],
    category: 'sauce',
    state: 'unknown',
    calories100g: 35,
    protein100g: 5,
    carbs100g: 3.6,
    fat100g: 0,
    fiber100g: 0,
    sugar100g: 3.6,
    sodium100g: 7850,
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
    ownerId: nearbyVnuNutritionOwners[0].id,
    categoryId: seedId(4, 1),
    zoneId: seedId(5, 1),
    name: 'Fresh Bowl VNU',
    description:
      'Balanced rice bowls and noodle salads for students around VNU-HCM.',
    address:
      'Internal Road, VNU-HCM University Village, Linh Trung, Thu Duc, HCMC',
    phone: '0905601001',
    cuisineType: 'Healthy Vietnamese',
    logoUrl: seedImages.freshBowlLogo.secureUrl,
    coverImageUrl: seedImages.freshBowlCover.secureUrl,
    latitude: TARGET_LATITUDE + 0.00015,
    longitude: TARGET_LONGITUDE - 0.00022,
    categoryName: 'Balanced Bowls',
    items: [
      item(1, 'Lemongrass Chicken Rice Bowl', {
        description:
          'Grilled chicken breast, steamed rice, greens, herbs, and light fish sauce.',
        price: 68000,
        tags: [],
        imageUrl: seedImages.chickenRiceBowl.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'chickenBreastGrilled',
            'grilled chicken breast',
            140,
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
          ingredient('lettuce', 'lettuce', 50, 'g', 'raw', 'main'),
          ingredient('cucumber', 'cucumber', 40, 'g', 'raw', 'main'),
          ingredient(
            'freshHerbs',
            'mixed fresh herbs',
            12,
            'g',
            'raw',
            'herb_side',
          ),
          ingredient(
            'fishSauce',
            'fish sauce dressing',
            15,
            'g',
            'unknown',
            'sauce',
          ),
          ingredient('oliveOil', 'olive oil', 5, 'g', 'unknown', 'sauce'),
        ],
      }),
      item(2, 'Tofu Brown Rice Bowl', {
        description:
          'Firm tofu, brown rice, lettuce, tomato, cucumber, sesame oil, and soy dressing.',
        price: 62000,
        tags: ['vegetarian', 'vegan'],
        imageUrl: seedImages.tofuBrownRiceBowl.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('tofuFirm', 'firm tofu', 160, 'g', 'cooked', 'main'),
          ingredient(
            'brownRiceCooked',
            'cooked brown rice',
            170,
            'g',
            'cooked',
            'main',
          ),
          ingredient('lettuce', 'lettuce', 60, 'g', 'raw', 'main'),
          ingredient('tomato', 'tomato', 50, 'g', 'raw', 'main'),
          ingredient('cucumber', 'cucumber', 45, 'g', 'raw', 'main'),
          ingredient('soySauce', 'soy sauce', 12, 'g', 'unknown', 'sauce'),
          ingredient('sesameOil', 'sesame oil', 4, 'g', 'unknown', 'sauce'),
        ],
      }),
      item(3, 'Shrimp Vermicelli Salad', {
        description:
          'Rice vermicelli with shrimp, lettuce, cucumber, carrot, herbs, peanuts, and fish sauce.',
        price: 72000,
        tags: ['pescatarian'],
        imageUrl: seedImages.shrimpVermicelliSalad.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'shrimpCooked',
            'cooked shrimp',
            120,
            'g',
            'cooked',
            'main',
          ),
          ingredient(
            'riceVermicelliCooked',
            'cooked rice vermicelli',
            170,
            'g',
            'cooked',
            'main',
          ),
          ingredient('lettuce', 'lettuce', 50, 'g', 'raw', 'main'),
          ingredient('cucumber', 'cucumber', 45, 'g', 'raw', 'main'),
          ingredient('carrotRaw', 'shredded carrot', 35, 'g', 'raw', 'main'),
          ingredient(
            'freshHerbs',
            'mixed fresh herbs',
            15,
            'g',
            'raw',
            'herb_side',
          ),
          ingredient(
            'peanuts',
            'roasted peanuts',
            12,
            'g',
            'cooked',
            'garnish',
          ),
          ingredient(
            'fishSauce',
            'fish sauce dressing',
            18,
            'g',
            'unknown',
            'sauce',
          ),
        ],
      }),
      item(4, 'Beef Pho Protein Bowl', {
        description:
          'Lean grilled beef with rice noodles, herbs, lettuce, and cucumber.',
        price: 79000,
        tags: [],
        imageUrl: seedImages.beefPhoProteinBowl.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'beefLeanGrilled',
            'grilled lean beef',
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
          ingredient('lettuce', 'lettuce', 50, 'g', 'raw', 'main'),
          ingredient('cucumber', 'cucumber', 40, 'g', 'raw', 'main'),
          ingredient(
            'freshHerbs',
            'mixed fresh herbs',
            15,
            'g',
            'raw',
            'herb_side',
          ),
          ingredient(
            'fishSauce',
            'fish sauce dressing',
            15,
            'g',
            'unknown',
            'sauce',
          ),
        ],
      }),
    ],
  },
  {
    id: seedId(3, 2),
    ownerId: nearbyVnuNutritionOwners[1].id,
    categoryId: seedId(4, 2),
    zoneId: seedId(5, 2),
    name: 'Grill Lab KTX',
    description: 'Grilled Vietnamese lunch plates near the dormitory blocks.',
    address: 'KTX Area B, VNU-HCM University Village, Di An, Binh Duong',
    phone: '0905601002',
    cuisineType: 'Grill',
    logoUrl: seedImages.grillLabLogo.secureUrl,
    coverImageUrl: seedImages.grillLabCover.secureUrl,
    latitude: TARGET_LATITUDE + 0.00042,
    longitude: TARGET_LONGITUDE + 0.0004,
    categoryName: 'Grill Plates',
    items: [
      item(5, 'Honey Pork Chop Rice', {
        description:
          'Grilled pork chop over white rice with cucumber, tomato, and honey fish sauce glaze.',
        price: 76000,
        tags: [],
        imageUrl: seedImages.honeyPorkChopRice.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'porkChopGrilled',
            'grilled pork chop',
            150,
            'g',
            'grilled',
            'main',
          ),
          ingredient(
            'whiteRiceCooked',
            'cooked white rice',
            190,
            'g',
            'cooked',
            'main',
          ),
          ingredient('cucumber', 'cucumber', 45, 'g', 'raw', 'main'),
          ingredient('tomato', 'tomato', 45, 'g', 'raw', 'main'),
          ingredient('honey', 'honey glaze', 10, 'g', 'unknown', 'sauce'),
          ingredient('fishSauce', 'fish sauce', 12, 'g', 'unknown', 'sauce'),
        ],
      }),
      item(6, 'Grilled Chicken Banh Mi', {
        description:
          'Vietnamese baguette filled with grilled chicken, carrot, cucumber, herbs, and sauce.',
        price: 54000,
        tags: [],
        imageUrl: seedImages.grilledChickenBanhMi.secureUrl,
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
          ingredient(
            'chickenBreastGrilled',
            'grilled chicken breast',
            110,
            'g',
            'grilled',
            'main',
          ),
          ingredient('carrotRaw', 'shredded carrot', 30, 'g', 'raw', 'main'),
          ingredient('cucumber', 'cucumber', 25, 'g', 'raw', 'main'),
          ingredient(
            'freshHerbs',
            'mixed fresh herbs',
            8,
            'g',
            'raw',
            'herb_side',
          ),
          ingredient('soySauce', 'soy sauce', 8, 'g', 'unknown', 'sauce'),
        ],
      }),
      item(7, 'Beef Skewer Vermicelli', {
        description:
          'Grilled lean beef skewers with vermicelli, greens, peanuts, and fish sauce.',
        price: 82000,
        tags: [],
        imageUrl: seedImages.beefSkewerVermicelli.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'beefLeanGrilled',
            'grilled lean beef',
            150,
            'g',
            'grilled',
            'main',
          ),
          ingredient(
            'riceVermicelliCooked',
            'cooked rice vermicelli',
            170,
            'g',
            'cooked',
            'main',
          ),
          ingredient('lettuce', 'lettuce', 45, 'g', 'raw', 'main'),
          ingredient('cucumber', 'cucumber', 40, 'g', 'raw', 'main'),
          ingredient(
            'peanuts',
            'roasted peanuts',
            15,
            'g',
            'cooked',
            'garnish',
          ),
          ingredient(
            'fishSauce',
            'fish sauce dressing',
            16,
            'g',
            'unknown',
            'sauce',
          ),
        ],
      }),
      item(8, 'Salmon Rice Plate', {
        description:
          'Grilled salmon served with brown rice, lettuce, cucumber, tomato, and sesame soy sauce.',
        price: 98000,
        tags: ['pescatarian'],
        imageUrl: seedImages.salmonRicePlate.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'salmonGrilled',
            'grilled salmon',
            130,
            'g',
            'grilled',
            'main',
          ),
          ingredient(
            'brownRiceCooked',
            'cooked brown rice',
            180,
            'g',
            'cooked',
            'main',
          ),
          ingredient('lettuce', 'lettuce', 45, 'g', 'raw', 'main'),
          ingredient('cucumber', 'cucumber', 40, 'g', 'raw', 'main'),
          ingredient('tomato', 'tomato', 45, 'g', 'raw', 'main'),
          ingredient('soySauce', 'soy sauce', 10, 'g', 'unknown', 'sauce'),
          ingredient('sesameOil', 'sesame oil', 4, 'g', 'unknown', 'sauce'),
        ],
      }),
    ],
  },
  {
    id: seedId(3, 3),
    ownerId: nearbyVnuNutritionOwners[2].id,
    categoryId: seedId(4, 3),
    zoneId: seedId(5, 3),
    name: 'Morning Market Cafe',
    description:
      'Breakfast bowls, toast, yogurt, and simple cafe meals near VNU-HCM.',
    address:
      'Student Service Lane, VNU-HCM University Village, Linh Trung, Thu Duc, HCMC',
    phone: '0905601003',
    cuisineType: 'Cafe',
    logoUrl: seedImages.morningMarketLogo.secureUrl,
    coverImageUrl: seedImages.morningMarketCover.secureUrl,
    latitude: TARGET_LATITUDE - 0.00033,
    longitude: TARGET_LONGITUDE - 0.0005,
    categoryName: 'Breakfast and Cafe',
    items: [
      item(9, 'Egg Avocado Toast', {
        description:
          'Whole wheat toast with boiled egg, avocado, tomato, and olive oil.',
        price: 59000,
        tags: ['vegetarian'],
        imageUrl: seedImages.eggAvocadoToast.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'wholeWheatBread',
            'whole wheat bread',
            80,
            'g',
            'cooked',
            'main',
          ),
          ingredient(
            'eggBoiled',
            'boiled chicken egg',
            100,
            'g',
            'boiled',
            'main',
          ),
          ingredient('avocado', 'avocado', 70, 'g', 'raw', 'main'),
          ingredient('tomato', 'tomato', 40, 'g', 'raw', 'main'),
          ingredient('oliveOil', 'olive oil', 5, 'g', 'unknown', 'sauce'),
        ],
      }),
      item(10, 'Tuna Brown Rice Salad', {
        description:
          'Brown rice salad with tuna, lettuce, cucumber, tomato, carrot, and light soy dressing.',
        price: 69000,
        tags: ['pescatarian'],
        imageUrl: seedImages.tunaBrownRiceSalad.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'tunaCanned',
            'canned tuna in water',
            120,
            'g',
            'cooked',
            'main',
          ),
          ingredient(
            'brownRiceCooked',
            'cooked brown rice',
            150,
            'g',
            'cooked',
            'main',
          ),
          ingredient('lettuce', 'lettuce', 60, 'g', 'raw', 'main'),
          ingredient('cucumber', 'cucumber', 45, 'g', 'raw', 'main'),
          ingredient('tomato', 'tomato', 45, 'g', 'raw', 'main'),
          ingredient('carrotRaw', 'shredded carrot', 30, 'g', 'raw', 'main'),
          ingredient('soySauce', 'soy sauce', 10, 'g', 'unknown', 'sauce'),
        ],
      }),
      item(11, 'Yogurt Fruit Granola Bowl', {
        description:
          'Plain Greek yogurt with banana, mango, granola, and honey.',
        price: 56000,
        tags: ['vegetarian'],
        imageUrl: seedImages.yogurtFruitGranola.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'greekYogurt',
            'plain Greek yogurt',
            180,
            'g',
            'unknown',
            'main',
          ),
          ingredient('banana', 'banana', 70, 'g', 'raw', 'main'),
          ingredient('mango', 'mango', 80, 'g', 'raw', 'main'),
          ingredient('granola', 'granola', 35, 'g', 'cooked', 'main'),
          ingredient('honey', 'honey', 8, 'g', 'unknown', 'sauce'),
        ],
      }),
      item(12, 'Chicken Porridge Bowl', {
        description:
          'Rice porridge with grilled chicken breast, egg, herbs, and fish sauce.',
        price: 52000,
        tags: [],
        imageUrl: seedImages.chickenPorridgeBowl.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'ricePorridge',
            'plain rice porridge',
            280,
            'g',
            'cooked',
            'main',
          ),
          ingredient(
            'chickenBreastGrilled',
            'grilled chicken breast',
            90,
            'g',
            'grilled',
            'main',
          ),
          ingredient(
            'eggBoiled',
            'boiled chicken egg',
            50,
            'g',
            'boiled',
            'main',
          ),
          ingredient(
            'freshHerbs',
            'mixed fresh herbs',
            8,
            'g',
            'raw',
            'herb_side',
          ),
          ingredient('fishSauce', 'fish sauce', 8, 'g', 'unknown', 'sauce'),
        ],
      }),
    ],
  },
];

const restaurantSeedNames = restaurantsData.map(
  (restaurant) => restaurant.name,
);

async function main() {
  console.log('Starting nearby VNU nutrition seeding...');

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

  console.log('Nearby VNU nutrition seeding completed.');
  process.exit(0);
}

async function cleanupExistingSeedData() {
  console.log('Cleaning up existing nearby VNU nutrition seed data...');

  const ownerIds = nearbyVnuNutritionOwners.map((owner) => owner.id);
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
      nearbyVnuNutritionImages.map((asset) => asset.publicId),
    ),
  );
}

async function seedOwnerAccounts() {
  const now = new Date();

  for (const owner of nearbyVnuNutritionOwners) {
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
  await db.insert(schema.images).values(nearbyVnuNutritionImages);
  console.log(`Seeded ${nearbyVnuNutritionImages.length} image records.`);
}

async function seedNutritionFoodDatabase(): Promise<Map<string, string>> {
  const rows = await db
    .insert(schema.nutritionFoods)
    .values(
      nutritionFoodSeeds.map((food) => ({
        nameVi: food.nameVi,
        nameEn: food.nameEn,
        source: 'NEARBY_VNU_NUTRITION_SEED',
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
    const key = row.sourceFoodId?.replace('nearby-vnu-nutrition:', '');
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
    name: 'VNU-HCM University Village delivery zone',
    radiusKm: 4,
    baseFee: 10000,
    perKmRate: 3500,
    avgSpeedKmh: 25,
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
  return `nearby-vnu-nutrition:${key}`;
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
  console.error('Nearby VNU nutrition seed failed:', error);
  process.exit(1);
});
