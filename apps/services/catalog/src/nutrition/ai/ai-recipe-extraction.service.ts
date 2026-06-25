import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OllamaAiProvider } from '@/lib/ai/ollama-ai.provider';
import {
  extractedRecipeSchema,
  type AiExtractedRecipe,
} from './ai-recipe.schema';
import {
  NUTRITION_UNITS,
  type ExtractedRecipe,
  type ExtractedRecipeIngredient,
  type NutritionUnit,
} from '../types/nutrition.types';

const EXTRACTION_TIMEOUT_MS = 30_000;
const MAX_AI_ATTEMPTS = 2;

interface ParsedQuantity {
  value: number | null;
  approximate: boolean;
}

interface UnitAliasMatch {
  unit: NutritionUnit;
  quantityMultiplier?: number;
}

interface MeasurementInference {
  unit: NutritionUnit;
  quantity: number | null;
  sourceQuantity: number | null;
  approximate: boolean;
}

const QUANTITY_WORDS = new Map<string, ParsedQuantity>([
  ['nua', { value: 0.5, approximate: false }],
  ['mot', { value: 1, approximate: false }],
  ['hai', { value: 2, approximate: false }],
  ['ba', { value: 3, approximate: false }],
  ['bon', { value: 4, approximate: false }],
  ['tu', { value: 4, approximate: false }],
  ['nam', { value: 5, approximate: false }],
  ['sau', { value: 6, approximate: false }],
  ['bay', { value: 7, approximate: false }],
  ['tam', { value: 8, approximate: false }],
  ['chin', { value: 9, approximate: false }],
  ['muoi', { value: 10, approximate: false }],
  ['vai', { value: 3, approximate: true }],
]);

const UNIT_ALIAS_RULES: Array<UnitAliasMatch & { aliases: string[] }> = [
  {
    unit: 'g',
    aliases: ['g', 'gr', 'gram', 'grams', 'gam'],
  },
  {
    unit: 'g',
    quantityMultiplier: 100,
    aliases: ['lang', 'luong'],
  },
  {
    unit: 'kg',
    aliases: ['kg', 'kilogram', 'kilograms', 'kilo', 'ki', 'ky', 'can'],
  },
  {
    unit: 'ml',
    aliases: ['ml', 'milliliter', 'milliliters', 'mililiter'],
  },
  {
    unit: 'l',
    aliases: ['l', 'lit', 'liter', 'liters'],
  },
  {
    unit: 'tbsp',
    aliases: [
      'tbsp',
      'tablespoon',
      'tablespoons',
      'muong canh',
      'thia canh',
      'muong lon',
    ],
  },
  {
    unit: 'tsp',
    aliases: [
      'tsp',
      'teaspoon',
      'teaspoons',
      'muong ca phe',
      'thia ca phe',
      'muong nho',
    ],
  },
  {
    unit: 'cup',
    aliases: ['cup', 'cups', 'coc', 'ly'],
  },
  {
    unit: 'bowl',
    aliases: ['bowl', 'bowls', 'bat', 'bat con', 'chen', 'to'],
  },
  {
    unit: 'bunch',
    aliases: ['bunch', 'handful', 'handfuls', 'mo', 'bo', 'ro'],
  },
  {
    unit: 'pinch',
    aliases: ['pinch', 'pinches', 'chut', 'it', 'nhum'],
  },
  {
    unit: 'piece',
    aliases: [
      'piece',
      'pieces',
      'pcs',
      'cai',
      'con',
      'cu',
      'qua',
      'trai',
      'tep',
      'nhanh',
      'la',
      'vat',
      'mieng',
    ],
  },
];

const SORTED_UNIT_ALIASES = UNIT_ALIAS_RULES.flatMap((rule) =>
  rule.aliases.map((alias) => ({
    alias,
    unit: rule.unit,
    quantityMultiplier: rule.quantityMultiplier,
  })),
).sort((left, right) => right.alias.length - left.alias.length);

const SYSTEM_PROMPT = [
  'Extract recipe name, servings, and ingredients.',
  'Do not calculate calories.',
  'Do not invent ingredients.',
  'If quantity is missing, use null.',
  'If unit is missing, use "unknown".',
  'If preparation state is unknown, use "unknown".',
  'Classify each ingredient into exactly one category: "main" for primary ingredients that contribute significantly to nutrition (meat, rice, noodles, vegetables with quantity); "seasoning" for dry seasonings added to taste (salt, pepper, sugar, MSG, spice powders); "sauce" for liquid condiments and sauces (fish sauce, soy sauce, oyster sauce, chili sauce); "garnish" for small decorative toppings (cilantro sprigs, sliced chili, fried shallots); "herb_side" for Vietnamese herb/vegetable sides served alongside the dish that are typically unmeasured (rau sống, rau thơm, rau ăn kèm).',
  'If uncertain about an ingredient, add a warning.',
  'Keep ingredient names in Vietnamese if the input is in Vietnamese.',
  'For every ingredient, also provide "canonicalNameEn": a concise English food name suitable for searching an English nutrition database. Use null only when no safe English equivalent is known.',
  'For every "canonicalNameEn", provide "canonicalNameConfidence" between 0 and 1. Use null when canonicalNameEn is null.',
  'Split compound ingredient lines into separate ingredients when multiple ingredients or quantities are present.',
  'Normalize Vietnamese quantity words when clear: nửa = 0.5, một = 1, hai = 2, vài = 3 with a warning.',
  'Normalize units: gam/gram -> g; kg/ký/kí/cân -> kg; lạng -> g and multiply quantity by 100; muỗng canh/thìa canh -> tbsp; muỗng cà phê/thìa cà phê -> tsp; ly/cốc -> cup; bát/chén/tô -> bowl; củ/quả/trái/vắt/miếng/nhánh -> piece; mớ/bó/nắm/rổ -> bunch; chút/ít/nhúm -> pinch.',
  'Return only data that matches the schema.',
  'Return raw JSON only. Do not wrap the JSON in Markdown code fences.',
  'IMPORTANT: You must return a valid JSON object strictly following this structure and camelCase keys:',
  '{',
  '  "recipeName": "string | null",',
  '  "servings": "number | null",',
  '  "ingredients": [',
  '    {',
  '      "rawText": "string",',
  '      "name": "string",',
  '      "canonicalNameEn": "string | null",',
  '      "canonicalNameConfidence": "number between 0 and 1 | null",',
  '      "quantity": "number | null",',
  '      "unit": "g|kg|ml|l|tbsp|tsp|piece|cup|bowl|bunch|pinch|unknown",',
  '      "preparation": "raw|cooked|fried|boiled|grilled|steamed|unknown",',
  '      "confidence": "number between 0 and 1",',
  '      "category": "main|seasoning|sauce|garnish|herb_side"',
  '    }',
  '  ],',
  '  "warnings": ["string"]',
  '}',
].join('\n');

@Injectable()
export class AiRecipeExtractionService {
  private readonly logger = new Logger(AiRecipeExtractionService.name);

  constructor(private readonly aiProvider: OllamaAiProvider) {}

  async extractRecipe(recipeText: string): Promise<ExtractedRecipe> {
    if (!this.aiProvider.isConfigured()) {
      throw new ServiceUnavailableException({
        message:
          'AI analysis service is not configured. Set OLLAMA_API_KEY for Ollama Cloud.',
        cause: 'OLLAMA_API_KEY is required for direct Ollama Cloud API access.',
      });
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
      try {
        const object = await this.generate(recipeText);
        return this.normalizeRecipe(object);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `AI recipe extraction attempt ${attempt} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw new ServiceUnavailableException({
      message:
        'AI analysis service is currently unavailable. Please try again or enter ingredients manually.',
      cause: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }

  private async generate(recipeText: string): Promise<AiExtractedRecipe> {
    const response = await this.aiProvider.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: recipeText },
      ],
      timeoutMs: EXTRACTION_TIMEOUT_MS,
      temperature: 0,
    });

    return extractedRecipeSchema.parse(
      this.parseOllamaContent(response.content),
    );
  }

  private parseOllamaContent(content: string): unknown {
    try {
      let cleaned = content.trim();
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleaned = jsonMatch[1];
      } else {
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          cleaned = cleaned.slice(firstBrace, lastBrace + 1);
        }
      }

      return this.normalizeLooseRecipeJson(JSON.parse(cleaned.trim()));
    } catch {
      throw new Error('Ollama Cloud API returned invalid JSON content.');
    }
  }

  private normalizeLooseRecipeJson(parsed: unknown): unknown {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return parsed;
    }

    const recipe = { ...(parsed as Record<string, unknown>) };

    if ('recipe_name' in recipe && !('recipeName' in recipe)) {
      recipe.recipeName = recipe.recipe_name;
    }
    delete recipe.recipe_name;

    if (!('recipeName' in recipe)) {
      recipe.recipeName = null;
    }
    if (!('servings' in recipe)) {
      recipe.servings = null;
    }
    if (!('warnings' in recipe)) {
      recipe.warnings = [];
    }

    if (Array.isArray(recipe.ingredients)) {
      recipe.ingredients = recipe.ingredients.map((ingredient) =>
        this.normalizeLooseIngredientJson(ingredient),
      );
    }

    return recipe;
  }

  private normalizeLooseIngredientJson(ingredient: unknown): unknown {
    if (typeof ingredient === 'string') {
      return {
        rawText: ingredient,
        name: ingredient,
        quantity: null,
        unit: 'unknown',
        preparation: 'unknown',
        confidence: 0.5,
      };
    }

    if (
      !ingredient ||
      typeof ingredient !== 'object' ||
      Array.isArray(ingredient)
    ) {
      return ingredient;
    }

    const normalized = { ...(ingredient as Record<string, unknown>) };

    if ('raw_text' in normalized && !('rawText' in normalized)) {
      normalized.rawText = normalized.raw_text;
    }
    delete normalized.raw_text;

    if ('preparation_state' in normalized && !('preparation' in normalized)) {
      normalized.preparation = normalized.preparation_state;
    }
    delete normalized.preparation_state;

    if (
      'english_name_guess' in normalized &&
      !('canonicalNameEn' in normalized)
    ) {
      normalized.canonicalNameEn = normalized.english_name_guess;
    }
    delete normalized.english_name_guess;

    if ('english_name' in normalized && !('canonicalNameEn' in normalized)) {
      normalized.canonicalNameEn = normalized.english_name;
    }
    delete normalized.english_name;

    if ('englishName' in normalized && !('canonicalNameEn' in normalized)) {
      normalized.canonicalNameEn = normalized.englishName;
    }
    delete normalized.englishName;

    if (
      'canonical_name_en' in normalized &&
      !('canonicalNameEn' in normalized)
    ) {
      normalized.canonicalNameEn = normalized.canonical_name_en;
    }
    delete normalized.canonical_name_en;

    if (
      'canonical_name_confidence' in normalized &&
      !('canonicalNameConfidence' in normalized)
    ) {
      normalized.canonicalNameConfidence = normalized.canonical_name_confidence;
    }
    delete normalized.canonical_name_confidence;

    if (!('category' in normalized)) {
      normalized.category = 'main';
    }

    if (!('rawText' in normalized) && typeof normalized.name === 'string') {
      normalized.rawText = normalized.name;
    }
    if (!('name' in normalized) && typeof normalized.rawText === 'string') {
      normalized.name = normalized.rawText;
    }
    const rawText =
      typeof normalized.rawText === 'string' ? normalized.rawText : '';
    const inferredMeasurement = this.inferMeasurementFromRawText(rawText);
    const parsedQuantity = this.parseQuantity(normalized.quantity);
    const normalizedUnit = this.normalizeUnit(normalized.unit);
    const notes = this.normalizeNotes(normalized.notes);
    let quantity = parsedQuantity.value;
    let approximate = parsedQuantity.approximate;
    let quantityWasNormalizedFromInference = false;
    const unit = normalizedUnit?.unit ?? inferredMeasurement?.unit ?? 'unknown';

    if (
      quantity === null &&
      inferredMeasurement &&
      inferredMeasurement.quantity !== null
    ) {
      quantity = inferredMeasurement.quantity;
      approximate = approximate || inferredMeasurement.approximate;
      quantityWasNormalizedFromInference = true;
    } else if (
      inferredMeasurement &&
      inferredMeasurement.sourceQuantity !== null &&
      inferredMeasurement.quantity !== null &&
      unit === inferredMeasurement.unit &&
      quantity === inferredMeasurement.sourceQuantity &&
      inferredMeasurement.quantity !== inferredMeasurement.sourceQuantity
    ) {
      quantity = inferredMeasurement.quantity;
      approximate = approximate || inferredMeasurement.approximate;
      quantityWasNormalizedFromInference = true;
    }

    if (
      !quantityWasNormalizedFromInference &&
      normalizedUnit?.quantityMultiplier &&
      quantity !== null
    ) {
      quantity = this.roundQuantity(
        quantity * normalizedUnit.quantityMultiplier,
      );
    }

    if (approximate) {
      const ingredientLabel =
        typeof normalized.name === 'string' && normalized.name.trim()
          ? normalized.name
          : rawText;

      normalized.requiresConfirmation = true;
      notes.push(
        `Approximate household quantity inferred for ${ingredientLabel}. Please confirm.`,
      );
    }

    normalized.quantity = quantity;
    normalized.unit = unit;
    normalized.canonicalNameEn = this.normalizeCanonicalNameEn(
      normalized.canonicalNameEn,
    );
    normalized.canonicalNameConfidence = this.normalizeCanonicalNameConfidence(
      normalized.canonicalNameConfidence,
      normalized.canonicalNameEn,
    );
    if (!('preparation' in normalized)) {
      normalized.preparation = 'unknown';
    }
    if (!('confidence' in normalized)) {
      normalized.confidence = 0.5;
    }
    normalized.requiresConfirmation = normalized.requiresConfirmation === true;
    normalized.notes = notes;

    return normalized;
  }

  private normalizeUnit(unit: unknown): UnitAliasMatch | null {
    if (typeof unit !== 'string') return null;

    const normalizedUnit = this.normalizeLooseText(unit);
    if (!normalizedUnit) return null;

    if ((NUTRITION_UNITS as readonly string[]).includes(normalizedUnit)) {
      return { unit: normalizedUnit as NutritionUnit };
    }

    const alias = SORTED_UNIT_ALIASES.find(
      (candidate) => candidate.alias === normalizedUnit,
    );
    return alias
      ? {
          unit: alias.unit,
          quantityMultiplier: alias.quantityMultiplier,
        }
      : null;
  }

  private inferMeasurementFromRawText(
    rawText: string,
  ): MeasurementInference | null {
    const normalizedRawText = this.normalizeLooseText(rawText);
    if (!normalizedRawText) return null;

    const matches = SORTED_UNIT_ALIASES.flatMap((alias) => {
      const unitPattern = this.escapeRegex(alias.alias).replace(/\s+/g, '\\s+');
      const numericPattern = new RegExp(
        `\\b(?<quantity>\\d+\\s*/\\s*\\d+|\\d+(?:[\\.,]\\d+)?)\\s*${unitPattern}\\b`,
      );
      const wordPattern = new RegExp(
        `\\b(?<quantity>${Array.from(QUANTITY_WORDS.keys()).join(
          '|',
        )})\\s+${unitPattern}\\b`,
      );
      const numericMatch = numericPattern.exec(normalizedRawText);
      const wordMatch = wordPattern.exec(normalizedRawText);

      return [numericMatch, wordMatch]
        .filter((match): match is RegExpExecArray => Boolean(match))
        .map((match) => ({
          index: match.index,
          alias,
          quantityToken: match.groups?.quantity,
        }));
    }).sort((left, right) => {
      if (left.index !== right.index) return left.index - right.index;
      return right.alias.alias.length - left.alias.alias.length;
    });

    const match = matches[0];
    if (!match?.quantityToken) return null;

    const parsedQuantity = this.parseQuantity(match.quantityToken);
    const sourceQuantity = parsedQuantity.value;
    const quantity =
      sourceQuantity === null
        ? null
        : this.roundQuantity(
            sourceQuantity * (match.alias.quantityMultiplier ?? 1),
          );

    return {
      unit: match.alias.unit,
      quantity,
      sourceQuantity,
      approximate: parsedQuantity.approximate,
    };
  }

  private parseQuantity(quantity: unknown): ParsedQuantity {
    if (typeof quantity === 'number' && Number.isFinite(quantity)) {
      return {
        value: quantity > 0 ? this.roundQuantity(quantity) : null,
        approximate: false,
      };
    }

    if (typeof quantity !== 'string') {
      return { value: null, approximate: false };
    }

    const normalizedQuantity = this.normalizeLooseText(quantity).replace(
      /,/g,
      '.',
    );
    if (!normalizedQuantity) {
      return { value: null, approximate: false };
    }

    const fractionMatch = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(
      normalizedQuantity,
    );
    if (fractionMatch) {
      const numerator = Number(fractionMatch[1]);
      const denominator = Number(fractionMatch[2]);
      return {
        value:
          denominator > 0 ? this.roundQuantity(numerator / denominator) : null,
        approximate: false,
      };
    }

    const numericValue = Number(normalizedQuantity);
    if (Number.isFinite(numericValue)) {
      return {
        value: numericValue > 0 ? this.roundQuantity(numericValue) : null,
        approximate: false,
      };
    }

    return (
      QUANTITY_WORDS.get(normalizedQuantity) ?? {
        value: null,
        approximate: false,
      }
    );
  }

  private normalizeNotes(notes: unknown): string[] {
    return Array.isArray(notes)
      ? notes.filter((note): note is string => typeof note === 'string')
      : [];
  }

  private normalizeCanonicalNameEn(value: unknown): string | null {
    if (typeof value !== 'string') return null;

    const cleaned = value.trim().replace(/\s+/g, ' ');
    return cleaned.length > 0 ? cleaned.slice(0, 120) : null;
  }

  private normalizeCanonicalNameConfidence(
    value: unknown,
    canonicalNameEn: unknown,
  ): number | null {
    if (!canonicalNameEn) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0.6;

    return Math.min(1, Math.max(0, value));
  }

  private normalizeLooseText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}/.,]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private roundQuantity(quantity: number): number {
    return Math.round(quantity * 1000) / 1000;
  }

  private normalizeRecipe(recipe: AiExtractedRecipe): ExtractedRecipe {
    const ingredients: ExtractedRecipeIngredient[] = recipe.ingredients.map(
      (ingredient) => ({
        ...ingredient,
        canonicalNameEn: ingredient.canonicalNameEn ?? null,
        canonicalNameConfidence: ingredient.canonicalNameConfidence ?? null,
        unit: ingredient.unit ?? 'unknown',
        preparation: ingredient.preparation ?? 'unknown',
        category: ingredient.category ?? 'main',
      }),
    );

    return {
      recipeName: recipe.recipeName,
      servings: recipe.servings,
      ingredients,
      warnings: recipe.warnings,
    };
  }
}
