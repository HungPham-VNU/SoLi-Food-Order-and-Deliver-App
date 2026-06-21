import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  nutritionFoodLocalizations,
  nutritionFoods,
} from '../domain/nutrition.schema';

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

const TRACKED_NUTRIENT_IDS: ReadonlySet<string> = new Set<string>(
  Object.values(NUTRIENT_IDS).flat(),
);

type CsvFileName = (typeof REQUIRED_CSV_FILES)[number];
type CsvRecord = Record<string, string>;
type NutritionFoodInsert = typeof nutritionFoods.$inferInsert;
type NutritionFoodLocalizationInsert =
  typeof nutritionFoodLocalizations.$inferInsert;
type Awaitable<T> = T | Promise<T>;

export interface UsdaCsvFiles {
  food: string;
  foodCategory: string;
  foodNutrient: string;
  foundationFood: string;
}

export interface UsdaCsvFilePaths {
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

export interface UsdaFoundationFoodStreamResult {
  importedFoodCount: number;
  foundationFoodCount: number;
  skippedMissingFoodRows: number;
  skippedMissingRequiredNutrients: number;
}

export interface UsdaFoundationFoodBatchOptions {
  batchSize?: number;
  onBatch: (foods: NutritionFoodInsert[]) => Awaitable<void>;
}

export interface UsdaEnglishLocalizationInput {
  nutritionFoodId: string;
  nameEn: string;
  aliases: string[];
}

export function hasRequiredUsdaCsvFiles(csvDir: string): boolean {
  return REQUIRED_CSV_FILES.every((fileName) =>
    existsSync(join(csvDir, fileName)),
  );
}

export function getUsdaCsvFilePaths(csvDir: string): UsdaCsvFilePaths {
  assertRequiredUsdaCsvFiles(csvDir);

  return {
    food: join(csvDir, 'food.csv'),
    foodCategory: join(csvDir, 'food_category.csv'),
    foodNutrient: join(csvDir, 'food_nutrient.csv'),
    foundationFood: join(csvDir, 'foundation_food.csv'),
  };
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

export async function streamUsdaFoundationNutritionFoodBatches(
  csvDir: string,
  options: UsdaFoundationFoodBatchOptions,
): Promise<UsdaFoundationFoodStreamResult> {
  const paths = getUsdaCsvFilePaths(csvDir);
  const batchSize = Math.max(1, options.batchSize ?? 100);

  const foundationFoodIds = await readFoundationFoodIds(paths.foundationFood);
  const foundationFoodCount = foundationFoodIds.size;
  const categoriesById = await readFoodCategories(paths.foodCategory);
  const nutrientsByFdcId = await readNutrientsByFdcId(
    paths.foodNutrient,
    foundationFoodIds,
  );

  const batch: NutritionFoodInsert[] = [];
  let importedFoodCount = 0;
  let skippedMissingRequiredNutrients = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const foods = batch.splice(0, batch.length);
    await options.onBatch(foods);
    importedFoodCount += foods.length;
  };

  for await (const food of parseCsvFile(paths.food)) {
    const fdcId = food.fdc_id;
    if (!foundationFoodIds.has(fdcId)) continue;

    foundationFoodIds.delete(fdcId);
    const nutritionFood = buildNutritionFoodInsert(
      food,
      nutrientsByFdcId.get(fdcId),
      categoriesById,
    );

    if (!nutritionFood) {
      skippedMissingRequiredNutrients += 1;
      continue;
    }

    batch.push(nutritionFood);
    if (batch.length >= batchSize) {
      await flush();
    }
  }

  await flush();

  return {
    importedFoodCount,
    foundationFoodCount,
    skippedMissingFoodRows: foundationFoodIds.size,
    skippedMissingRequiredNutrients,
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

    const nutritionFood = buildNutritionFoodInsert(
      food,
      nutrientsByFdcId.get(fdcId),
      categoriesById,
    );
    if (!nutritionFood) {
      skippedMissingRequiredNutrients += 1;
      continue;
    }

    foods.push(nutritionFood);
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

export function buildUsdaEnglishLocalization(
  input: UsdaEnglishLocalizationInput,
): NutritionFoodLocalizationInsert {
  return {
    nutritionFoodId: input.nutritionFoodId,
    locale: 'en',
    name: input.nameEn,
    aliases: input.aliases,
  };
}

async function readFoundationFoodIds(filePath: string): Promise<Set<string>> {
  const foundationFoodIds = new Set<string>();
  for await (const row of parseCsvFile(filePath)) {
    if (row.fdc_id) foundationFoodIds.add(row.fdc_id);
  }
  return foundationFoodIds;
}

async function readFoodCategories(
  filePath: string,
): Promise<Map<string, string>> {
  const categoriesById = new Map<string, string>();
  for await (const row of parseCsvFile(filePath)) {
    categoriesById.set(row.id, cleanText(row.description));
  }
  return categoriesById;
}

async function readNutrientsByFdcId(
  filePath: string,
  foundationFoodIds: Set<string>,
): Promise<Map<string, Map<string, number>>> {
  const nutrientsByFdcId = new Map<string, Map<string, number>>();

  for await (const row of parseCsvFile(filePath)) {
    addNutrientRow(nutrientsByFdcId, row, foundationFoodIds);
  }

  return nutrientsByFdcId;
}

async function* parseCsvFile(filePath: string): AsyncGenerator<CsvRecord> {
  let headers: string[] | null = null;

  for await (const row of parseCsvRowsFromFile(filePath)) {
    if (!headers) {
      headers = row.map((header) => header.trim());
      continue;
    }

    if (!row.some((cell) => cell.trim() !== '')) continue;

    yield Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? '']),
    );
  }
}

async function* parseCsvRowsFromFile(
  filePath: string,
): AsyncGenerator<string[]> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let isFirstCharacter = true;
  let skipNextLineFeed = false;
  let pendingQuoteInQuotedCell = false;

  for await (const chunk of stream) {
    const content = String(chunk);

    for (let index = 0; index < content.length; index += 1) {
      const char = content[index];

      if (isFirstCharacter) {
        isFirstCharacter = false;
        if (char === '\uFEFF') continue;
      }

      if (skipNextLineFeed) {
        skipNextLineFeed = false;
        if (char === '\n') continue;
      }

      if (pendingQuoteInQuotedCell) {
        pendingQuoteInQuotedCell = false;
        if (char === '"') {
          cell += '"';
          continue;
        }
        inQuotes = false;
      }

      if (inQuotes) {
        if (char === '"') {
          if (index + 1 >= content.length) {
            pendingQuoteInQuotedCell = true;
          } else if (content[index + 1] === '"') {
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
        yield row;
        row = [];
        cell = '';
        skipNextLineFeed = char === '\r';
        continue;
      }

      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    yield row;
  }
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
    addNutrientRow(nutrientsByFdcId, row, foundationFoodIds);
  }

  return nutrientsByFdcId;
}

function addNutrientRow(
  nutrientsByFdcId: Map<string, Map<string, number>>,
  row: CsvRecord,
  foundationFoodIds: Set<string>,
): void {
  if (!foundationFoodIds.has(row.fdc_id)) return;
  if (!TRACKED_NUTRIENT_IDS.has(row.nutrient_id)) return;

  const amount = parseFiniteNumber(row.amount);
  if (amount === null) return;

  let nutrients = nutrientsByFdcId.get(row.fdc_id);
  if (!nutrients) {
    nutrients = new Map<string, number>();
    nutrientsByFdcId.set(row.fdc_id, nutrients);
  }
  nutrients.set(row.nutrient_id, amount);
}

function buildNutritionFoodInsert(
  food: CsvRecord,
  nutrients: Map<string, number> | undefined,
  categoriesById: Map<string, string>,
): NutritionFoodInsert | null {
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
    return null;
  }

  const description = cleanText(food.description);

  return {
    nameVi: description,
    nameEn: description,
    source: 'USDA_FDC',
    sourceFoodId: food.fdc_id,
    aliases: buildAliases(description),
    category: categoriesById.get(food.food_category_id) ?? null,
    state: inferFoodState(description),
    calories100g,
    protein100g,
    carbs100g,
    fat100g,
    fiber100g: pickNutrient(nutrients, NUTRIENT_IDS.fiber),
    sugar100g: pickNutrient(nutrients, NUTRIENT_IDS.sugar),
    sodium100g: pickNutrient(nutrients, NUTRIENT_IDS.sodium),
  };
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
