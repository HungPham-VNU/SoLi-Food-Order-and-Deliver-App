import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nutritionFoods } from '../domain/nutrition.schema';

export const USDA_FOUNDATION_FOODS_RELEASE_DATE = '2026-04-30';
export const USDA_FOUNDATION_FOODS_ARCHIVE_URL =
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip';

const REQUIRED_CSV_FILES = [
  'food.csv',
  'food_category.csv',
  'food_nutrient.csv',
  'foundation_food.csv',
] as const;

const NUTRIENT_IDS = {
  energy: ['1008', '2048', '2047'],
  protein: ['1003'],
  fat: ['1004'],
  carbs: ['1005'],
  fiber: ['1079', '2033'],
  sugar: ['2000', '1063'],
  sodium: ['1093'],
} as const;

type CsvFileName = (typeof REQUIRED_CSV_FILES)[number];
type CsvRecord = Record<string, string>;
type NutritionFoodInsert = typeof nutritionFoods.$inferInsert;

export interface UsdaCsvFiles {
  food: string;
  foodCategory: string;
  foodNutrient: string;
  foundationFood: string;
}

export interface UsdaFoundationFoodBuildResult {
  foods: NutritionFoodInsert[];
  foundationFoodCount: number;
  skippedMissingFoodRows: number;
  skippedMissingRequiredNutrients: number;
}

export function hasRequiredUsdaCsvFiles(csvDir: string): boolean {
  return REQUIRED_CSV_FILES.every((fileName) =>
    existsSync(join(csvDir, fileName)),
  );
}

export function readUsdaCsvDirectory(csvDir: string): UsdaCsvFiles {
  assertRequiredUsdaCsvFiles(csvDir);

  return {
    food: readFileSync(join(csvDir, 'food.csv'), 'utf8'),
    foodCategory: readFileSync(join(csvDir, 'food_category.csv'), 'utf8'),
    foodNutrient: readFileSync(join(csvDir, 'food_nutrient.csv'), 'utf8'),
    foundationFood: readFileSync(join(csvDir, 'foundation_food.csv'), 'utf8'),
  };
}

export function assertRequiredUsdaCsvFiles(csvDir: string): void {
  const missing = REQUIRED_CSV_FILES.filter(
    (fileName) => !existsSync(join(csvDir, fileName)),
  );

  if (missing.length > 0) {
    throw new Error(
      `USDA Foundation Foods CSV directory is missing ${missing.join(', ')}.`,
    );
  }
}

export function buildUsdaFoundationNutritionFoods(
  files: UsdaCsvFiles,
): UsdaFoundationFoodBuildResult {
  const foundationFoodRows = parseCsv(files.foundationFood);
  const foodRows = parseCsv(files.food);
  const foodCategoryRows = parseCsv(files.foodCategory);
  const foodNutrientRows = parseCsv(files.foodNutrient);

  const foundationFoodIds = new Set(
    foundationFoodRows.map((row) => row.fdc_id).filter(Boolean),
  );
  const foodsByFdcId = new Map(
    foodRows
      .filter((row) => foundationFoodIds.has(row.fdc_id))
      .map((row) => [row.fdc_id, row]),
  );
  const categoriesById = new Map(
    foodCategoryRows.map((row) => [row.id, cleanText(row.description)]),
  );
  const nutrientsByFdcId = buildNutrientsByFdcId(
    foodNutrientRows,
    foundationFoodIds,
  );

  const foods: NutritionFoodInsert[] = [];
  let skippedMissingFoodRows = 0;
  let skippedMissingRequiredNutrients = 0;

  for (const fdcId of Array.from(foundationFoodIds).sort(compareNumericText)) {
    const food = foodsByFdcId.get(fdcId);
    if (!food) {
      skippedMissingFoodRows += 1;
      continue;
    }

    const nutrients = nutrientsByFdcId.get(fdcId);
    const calories100g = pickNutrient(nutrients, NUTRIENT_IDS.energy);
    const protein100g = pickNutrient(nutrients, NUTRIENT_IDS.protein);
    const carbs100g = pickNutrient(nutrients, NUTRIENT_IDS.carbs);
    const fat100g = pickNutrient(nutrients, NUTRIENT_IDS.fat);

    if (
      calories100g === null ||
      protein100g === null ||
      carbs100g === null ||
      fat100g === null
    ) {
      skippedMissingRequiredNutrients += 1;
      continue;
    }

    const description = cleanText(food.description);
    const state = inferFoodState(description);

    foods.push({
      nameVi: description,
      nameEn: description,
      aliases: buildAliases(description),
      category: categoriesById.get(food.food_category_id) ?? null,
      state,
      calories100g,
      protein100g,
      carbs100g,
      fat100g,
      fiber100g: pickNutrient(nutrients, NUTRIENT_IDS.fiber),
      sugar100g: pickNutrient(nutrients, NUTRIENT_IDS.sugar),
      sodium100g: pickNutrient(nutrients, NUTRIENT_IDS.sodium),
    });
  }

  return {
    foods,
    foundationFoodCount: foundationFoodIds.size,
    skippedMissingFoodRows,
    skippedMissingRequiredNutrients,
  };
}

export function parseCsv(content: string): CsvRecord[] {
  const rows = parseCsvRows(content.replace(/^\uFEFF/, ''));
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? '']),
      ),
    );
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n' || char === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';

      if (char === '\r' && content[index + 1] === '\n') {
        index += 1;
      }
      continue;
    }

    cell += char;
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function buildNutrientsByFdcId(
  nutrientRows: CsvRecord[],
  foundationFoodIds: Set<string>,
): Map<string, Map<string, number>> {
  const nutrientsByFdcId = new Map<string, Map<string, number>>();

  for (const row of nutrientRows) {
    if (!foundationFoodIds.has(row.fdc_id)) continue;

    const amount = parseFiniteNumber(row.amount);
    if (amount === null) continue;

    let nutrients = nutrientsByFdcId.get(row.fdc_id);
    if (!nutrients) {
      nutrients = new Map<string, number>();
      nutrientsByFdcId.set(row.fdc_id, nutrients);
    }
    nutrients.set(row.nutrient_id, amount);
  }

  return nutrientsByFdcId;
}

function pickNutrient(
  nutrients: Map<string, number> | undefined,
  nutrientIds: readonly string[],
): number | null {
  if (!nutrients) return null;

  for (const nutrientId of nutrientIds) {
    const amount = nutrients.get(nutrientId);
    if (amount !== undefined) return amount;
  }

  return null;
}

function inferFoodState(description: string): NutritionFoodInsert['state'] {
  const normalized = normalizeAlias(description);
  const hasRaw = /\braw\b/.test(normalized);
  const hasCooked =
    /\b(cooked|roasted|baked|broiled|braised|steamed|sauteed)\b/.test(
      normalized,
    );

  if (hasRaw && hasCooked) return 'unknown';
  if (hasRaw) return 'raw';
  if (/\bfried\b/.test(normalized)) return 'fried';
  if (/\bboiled\b/.test(normalized)) return 'boiled';
  if (/\bgrilled\b/.test(normalized)) return 'grilled';
  if (hasCooked) return 'cooked';
  return 'unknown';
}

function buildAliases(description: string): string[] {
  const aliases = new Set<string>();
  const normalizedDescription = normalizeAlias(description);
  const firstCommaSegment = normalizeAlias(description.split(',')[0] ?? '');

  addAlias(aliases, normalizedDescription);
  addAlias(aliases, firstCommaSegment);

  return Array.from(aliases).slice(0, 8);
}

function addAlias(aliases: Set<string>, alias: string): void {
  if (!alias || alias.length < 3) return;
  aliases.add(alias);
}

function cleanText(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeAlias(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseFiniteNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNumericText(left: string, right: string): number {
  return Number(left) - Number(right);
}

export function getRequiredUsdaCsvFiles(): readonly CsvFileName[] {
  return REQUIRED_CSV_FILES;
}
