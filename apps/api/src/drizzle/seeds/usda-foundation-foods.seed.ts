import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  getNodePostgresSslConfig,
  requireDatabaseUrl,
} from '../postgres-connection';
import {
  USDA_FOUNDATION_FOODS_ARCHIVE_URL,
  USDA_FOUNDATION_FOODS_RELEASE_DATE,
  buildUsdaEnglishLocalization,
  hasRequiredUsdaCsvFiles,
  streamUsdaFoundationNutritionFoodBatches,
} from '../../module/nutrition/import/usda-foundation-foods';
import {
  CUSTOM_VIETNAMESE_NUTRITION_FOODS,
  VIETNAMESE_USDA_LOCALIZATIONS,
} from '../../module/nutrition/import/vietnamese-nutrition-data';
import {
  nutritionFoodLocalizations,
  nutritionFoods,
} from '../../module/nutrition/domain/nutrition.schema';

const databaseUrl = requireDatabaseUrl();
const db = drizzle({
  connection: {
    connectionString: databaseUrl,
    ssl: getNodePostgresSslConfig(databaseUrl),
  },
});

type NutritionFoodInsert = typeof nutritionFoods.$inferInsert;
type NutritionFoodLocalizationInsert =
  typeof nutritionFoodLocalizations.$inferInsert;

async function main() {
  const csvDir = resolveCsvDir();
  const batchSize = 100;

  const result = await streamUsdaFoundationNutritionFoodBatches(csvDir, {
    batchSize,
    onBatch: async (batch) => {
      const foods = await db
        .insert(nutritionFoods)
        .values(batch)
        .onConflictDoUpdate({
          target: [nutritionFoods.nameVi, nutritionFoods.state],
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
          id: nutritionFoods.id,
          nameEn: nutritionFoods.nameEn,
          aliases: nutritionFoods.aliases,
        });

      await upsertFoodLocalizations(
        foods.map((food) =>
          buildUsdaEnglishLocalization({
            nutritionFoodId: food.id,
            nameEn: food.nameEn,
            aliases: food.aliases,
          }),
        ),
      );
    },
  });

  const vietnameseSeedResult = await seedVietnameseNutritionData();

  if (result.importedFoodCount === 0) {
    throw new Error('No USDA Foundation Foods rows were eligible for import.');
  }

  console.log(
    [
      `Imported ${result.importedFoodCount} USDA Foundation Foods nutrition rows.`,
      `Release: ${USDA_FOUNDATION_FOODS_RELEASE_DATE}.`,
      `Source CSV directory: ${csvDir}.`,
      `Skipped ${result.skippedMissingRequiredNutrients} of ${result.foundationFoodCount} Foundation Foods rows because calories/protein/carbs/fat were incomplete.`,
      `Seeded ${vietnameseSeedResult.localizationCount} Vietnamese nutrition localization rows.`,
      `Seeded ${vietnameseSeedResult.customFoodCount} custom Vietnamese nutrition estimate rows.`,
      result.skippedMissingFoodRows > 0
        ? `Skipped ${result.skippedMissingFoodRows} Foundation Foods rows missing food.csv metadata.`
        : null,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  process.exit(0);
}

async function seedVietnameseNutritionData(): Promise<{
  customFoodCount: number;
  localizationCount: number;
}> {
  const localizationRows: NutritionFoodLocalizationInsert[] = [];

  const customFoodRows = await upsertCustomVietnameseFoods(
    CUSTOM_VIETNAMESE_NUTRITION_FOODS.map((seed) => seed.food),
  );
  const customFoodIdsBySourceFoodId = new Map(
    customFoodRows
      .filter((food) => food.sourceFoodId)
      .map((food) => [food.sourceFoodId!, food.id]),
  );

  for (const seed of CUSTOM_VIETNAMESE_NUTRITION_FOODS) {
    const nutritionFoodId = customFoodIdsBySourceFoodId.get(
      seed.food.sourceFoodId ?? '',
    );
    if (!nutritionFoodId) continue;

    localizationRows.push(
      ...seed.localizations.map((localization) => ({
        nutritionFoodId,
        ...localization,
      })),
    );
  }

  const usdaSourceFoodIds = VIETNAMESE_USDA_LOCALIZATIONS.map(
    (seed) => seed.sourceFoodId,
  );
  const usdaFoods =
    usdaSourceFoodIds.length === 0
      ? []
      : await db
          .select({
            id: nutritionFoods.id,
            sourceFoodId: nutritionFoods.sourceFoodId,
          })
          .from(nutritionFoods)
          .where(
            and(
              eq(nutritionFoods.source, 'USDA_FDC'),
              inArray(nutritionFoods.sourceFoodId, usdaSourceFoodIds),
            ),
          );
  const usdaFoodIdsBySourceFoodId = new Map(
    usdaFoods
      .filter((food) => food.sourceFoodId)
      .map((food) => [food.sourceFoodId!, food.id]),
  );

  for (const seed of VIETNAMESE_USDA_LOCALIZATIONS) {
    const nutritionFoodId = usdaFoodIdsBySourceFoodId.get(seed.sourceFoodId);
    if (!nutritionFoodId) continue;

    localizationRows.push({
      nutritionFoodId,
      ...seed.localization,
    });
  }

  await upsertFoodLocalizations(localizationRows);

  return {
    customFoodCount: customFoodRows.length,
    localizationCount: localizationRows.length,
  };
}

async function upsertCustomVietnameseFoods(foods: NutritionFoodInsert[]) {
  if (foods.length === 0) return [];

  return db
    .insert(nutritionFoods)
    .values(foods)
    .onConflictDoUpdate({
      target: [nutritionFoods.nameVi, nutritionFoods.state],
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
      id: nutritionFoods.id,
      sourceFoodId: nutritionFoods.sourceFoodId,
    });
}

async function upsertFoodLocalizations(
  rows: NutritionFoodLocalizationInsert[],
): Promise<void> {
  if (rows.length === 0) return;

  await db
    .insert(nutritionFoodLocalizations)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        nutritionFoodLocalizations.nutritionFoodId,
        nutritionFoodLocalizations.locale,
      ],
      set: {
        name: sql`excluded.name`,
        aliases: sql`excluded.aliases`,
        updatedAt: new Date(),
      },
    });
}

function resolveCsvDir(): string {
  const candidate = [
    process.env.USDA_FOUNDATION_FOOD_CSV_DIR,
    process.argv[2],
    join(
      process.cwd(),
      '.tmp',
      'usda',
      `foundation_food_csv_${USDA_FOUNDATION_FOODS_RELEASE_DATE}`,
      `FoodData_Central_foundation_food_csv_${USDA_FOUNDATION_FOODS_RELEASE_DATE}`,
    ),
    join(
      process.cwd(),
      '..',
      '..',
      '.tmp',
      'usda',
      `foundation_food_csv_${USDA_FOUNDATION_FOODS_RELEASE_DATE}`,
      `FoodData_Central_foundation_food_csv_${USDA_FOUNDATION_FOODS_RELEASE_DATE}`,
    ),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => resolve(value))
    .find((value) => existsSync(value) && hasRequiredUsdaCsvFiles(value));

  if (candidate) return candidate;

  throw new Error(
    [
      'USDA Foundation Foods CSV directory was not found.',
      `Download ${USDA_FOUNDATION_FOODS_ARCHIVE_URL}`,
      'Extract it, then rerun with USDA_FOUNDATION_FOOD_CSV_DIR pointing at the extracted folder that contains food.csv.',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error('USDA Foundation Foods seed failed:', error);
  process.exit(1);
});
