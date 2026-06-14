import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  USDA_FOUNDATION_FOODS_ARCHIVE_URL,
  USDA_FOUNDATION_FOODS_RELEASE_DATE,
  hasRequiredUsdaCsvFiles,
  streamUsdaFoundationNutritionFoodBatches,
} from '../../module/nutrition/import/usda-foundation-foods';
import { nutritionFoods } from '../../module/nutrition/domain/nutrition.schema';

const db = drizzle(process.env.DATABASE_URL!);

async function main() {
  const csvDir = resolveCsvDir();
  const batchSize = 100;

  const result = await streamUsdaFoundationNutritionFoodBatches(csvDir, {
    batchSize,
    onBatch: async (batch) => {
      await db
        .insert(nutritionFoods)
        .values(batch)
        .onConflictDoUpdate({
          target: [nutritionFoods.nameVi, nutritionFoods.state],
          set: {
            nameEn: sql`excluded.name_en`,
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
        });
    },
  });

  if (result.importedFoodCount === 0) {
    throw new Error('No USDA Foundation Foods rows were eligible for import.');
  }

  console.log(
    [
      `Imported ${result.importedFoodCount} USDA Foundation Foods nutrition rows.`,
      `Release: ${USDA_FOUNDATION_FOODS_RELEASE_DATE}.`,
      `Source CSV directory: ${csvDir}.`,
      `Skipped ${result.skippedMissingRequiredNutrients} of ${result.foundationFoodCount} Foundation Foods rows because calories/protein/carbs/fat were incomplete.`,
      result.skippedMissingFoodRows > 0
        ? `Skipped ${result.skippedMissingFoodRows} Foundation Foods rows missing food.csv metadata.`
        : null,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  process.exit(0);
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
