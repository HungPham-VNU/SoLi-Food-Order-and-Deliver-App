import {
  nutritionFoodLocalizations,
  nutritionFoods,
} from '../domain/nutrition.schema';

type NutritionFoodInsert = typeof nutritionFoods.$inferInsert;
type NutritionFoodLocalizationInsert =
  typeof nutritionFoodLocalizations.$inferInsert;

export type NutritionFoodLocalizationSeed = Omit<
  NutritionFoodLocalizationInsert,
  'nutritionFoodId'
>;

export interface VietnameseUsdaLocalizationSeed {
  sourceFoodId: string;
  localization: NutritionFoodLocalizationSeed;
}

export interface CustomVietnameseNutritionFoodSeed {
  food: NutritionFoodInsert;
  localizations: NutritionFoodLocalizationSeed[];
}

export const DEFAULT_NUTRITION_LOCALE = 'vi';

export const VIETNAMESE_USDA_LOCALIZATIONS: VietnameseUsdaLocalizationSeed[] = [
  {
    sourceFoodId: '2727576',
    localization: localization('vi', 'ba chỉ heo', [
      'ba rọi',
      'thịt lợn ba chỉ',
      'thịt heo ba chỉ',
      'pork belly',
    ]),
  },
  {
    sourceFoodId: '2514745',
    localization: localization('vi', 'thịt heo xay', [
      'thịt lợn xay',
      'thịt heo băm',
      'thịt lợn băm',
      'heo xay',
      'ground pork',
    ]),
  },
  {
    sourceFoodId: '1104647',
    localization: localization('vi', 'tỏi', ['củ tỏi', 'garlic']),
  },
  {
    sourceFoodId: '2727586',
    localization: localization('vi', 'hành khô', [
      'hành tím',
      'củ hành',
      'shallot',
    ]),
  },
  {
    sourceFoodId: '2258586',
    localization: localization('vi', 'cà rốt', ['carrot', 'carrots']),
  },
  {
    sourceFoodId: '2346391',
    localization: localization('vi', 'xà lách', [
      'rau xà lách',
      'lettuce',
      'green leaf lettuce',
    ]),
  },
  {
    sourceFoodId: '746784',
    localization: localization('vi', 'đường', [
      'đường cát',
      'đường trắng',
      'sugar',
      'granulated sugar',
    ]),
  },
];

export const CUSTOM_VIETNAMESE_NUTRITION_FOODS: CustomVietnameseNutritionFoodSeed[] =
  [
    customFood({
      sourceFoodId: 'vn-pork-shoulder-raw',
      nameVi: 'nạc vai heo',
      nameEn: 'pork shoulder, raw',
      category: 'Vietnamese project estimate',
      state: 'raw',
      calories100g: 186,
      protein100g: 20,
      carbs100g: 0,
      fat100g: 12,
      fiber100g: null,
      sugar100g: null,
      sodium100g: 65,
      viAliases: [
        'nạc vai',
        'nạc vai băm',
        'thịt nạc vai',
        'thịt vai băm',
        'thịt lợn nạc vai',
      ],
      enAliases: ['pork shoulder', 'ground pork shoulder'],
    }),
    customFood({
      sourceFoodId: 'vn-fresh-rice-vermicelli',
      nameVi: 'bún tươi',
      nameEn: 'fresh rice vermicelli noodles',
      category: 'Vietnamese project estimate',
      state: 'cooked',
      calories100g: 110,
      protein100g: 1.7,
      carbs100g: 25.7,
      fat100g: 0.2,
      fiber100g: 0.5,
      sugar100g: 0.1,
      sodium100g: 10,
      viAliases: ['bún', 'bún gạo', 'bún tươi sợi nhỏ'],
      enAliases: ['rice vermicelli', 'rice noodles', 'fresh rice noodles'],
    }),
    customFood({
      sourceFoodId: 'vn-fish-sauce',
      nameVi: 'nước mắm',
      nameEn: 'fish sauce',
      category: 'Vietnamese project estimate',
      state: 'unknown',
      calories100g: 35,
      protein100g: 5,
      carbs100g: 3.6,
      fat100g: 0,
      fiber100g: null,
      sugar100g: 3.6,
      sodium100g: 7850,
      viAliases: ['nước mắm ngon', 'mắm cá'],
      enAliases: ['fish sauce'],
    }),
    customFood({
      sourceFoodId: 'vn-honey',
      nameVi: 'mật ong',
      nameEn: 'honey',
      category: 'Vietnamese project estimate',
      state: 'unknown',
      calories100g: 304,
      protein100g: 0.3,
      carbs100g: 82.4,
      fat100g: 0,
      fiber100g: 0,
      sugar100g: 82.1,
      sodium100g: 4,
      viAliases: ['mật ong nguyên chất'],
      enAliases: ['honey'],
    }),
    customFood({
      sourceFoodId: 'vn-caramel-cooking-sauce',
      nameVi: 'nước hàng',
      nameEn: 'caramel cooking sauce',
      category: 'Vietnamese project estimate',
      state: 'unknown',
      calories100g: 250,
      protein100g: 0,
      carbs100g: 65,
      fat100g: 0,
      fiber100g: null,
      sugar100g: 65,
      sodium100g: 50,
      viAliases: ['nước màu', 'kẹo đắng'],
      enAliases: ['caramel sauce', 'caramel color'],
    }),
    customFood({
      sourceFoodId: 'vn-green-papaya-raw',
      nameVi: 'đu đủ xanh',
      nameEn: 'green papaya, raw',
      category: 'Vietnamese project estimate',
      state: 'raw',
      calories100g: 43,
      protein100g: 0.5,
      carbs100g: 10.8,
      fat100g: 0.3,
      fiber100g: 1.7,
      sugar100g: 7.8,
      sodium100g: 8,
      viAliases: ['đu đủ sống', 'đu đủ bào'],
      enAliases: ['green papaya', 'raw papaya'],
    }),
    customFood({
      sourceFoodId: 'vn-mixed-fresh-herbs',
      nameVi: 'rau thơm',
      nameEn: 'mixed Vietnamese herbs',
      category: 'Vietnamese project estimate',
      state: 'raw',
      calories100g: 30,
      protein100g: 3,
      carbs100g: 5,
      fat100g: 0.7,
      fiber100g: 3.5,
      sugar100g: 1,
      sodium100g: 30,
      viAliases: [
        'rau sống',
        'rau ăn kèm',
        'tía tô',
        'kinh giới',
        'húng',
        'rau gia vị',
      ],
      enAliases: ['fresh herbs', 'mixed herbs', 'perilla', 'vietnamese balm'],
    }),
    customFood({
      sourceFoodId: 'vn-fresh-chili-pepper',
      nameVi: 'ớt tươi',
      nameEn: 'fresh chili pepper',
      category: 'Vietnamese project estimate',
      state: 'raw',
      calories100g: 40,
      protein100g: 1.9,
      carbs100g: 8.8,
      fat100g: 0.4,
      fiber100g: 1.5,
      sugar100g: 5.3,
      sodium100g: 9,
      viAliases: ['ớt', 'ớt đỏ', 'ớt hiểm'],
      enAliases: ['chili pepper', 'red chili'],
    }),
  ];

export function normalizeNutritionText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildNutritionAliases(
  name: string,
  aliases: readonly string[],
): string[] {
  const values = new Set<string>();

  for (const value of [name, ...aliases]) {
    const cleaned = cleanText(value).toLowerCase();
    const normalized = normalizeNutritionText(value);

    if (cleaned.length >= 2) values.add(cleaned);
    if (normalized.length >= 2) values.add(normalized);
  }

  return Array.from(values).slice(0, 16);
}

function customFood(input: {
  sourceFoodId: string;
  nameVi: string;
  nameEn: string;
  category: string;
  state: NutritionFoodInsert['state'];
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  fiber100g: number | null;
  sugar100g: number | null;
  sodium100g: number | null;
  viAliases: string[];
  enAliases: string[];
}): CustomVietnameseNutritionFoodSeed {
  return {
    food: {
      nameVi: input.nameVi,
      nameEn: input.nameEn,
      source: 'CUSTOM_VN',
      sourceFoodId: input.sourceFoodId,
      aliases: buildNutritionAliases(input.nameVi, [
        input.nameEn,
        ...input.viAliases,
        ...input.enAliases,
      ]),
      category: input.category,
      state: input.state,
      calories100g: input.calories100g,
      protein100g: input.protein100g,
      carbs100g: input.carbs100g,
      fat100g: input.fat100g,
      fiber100g: input.fiber100g,
      sugar100g: input.sugar100g,
      sodium100g: input.sodium100g,
    },
    localizations: [
      localization('vi', input.nameVi, input.viAliases),
      localization('en', input.nameEn, input.enAliases),
    ],
  };
}

function localization(
  locale: string,
  name: string,
  aliases: string[],
): NutritionFoodLocalizationSeed {
  return {
    locale,
    name,
    aliases: buildNutritionAliases(name, aliases),
  };
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
