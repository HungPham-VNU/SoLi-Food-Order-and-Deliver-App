import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import {
  extractedRecipeSchema,
  type AiExtractedRecipe,
} from './ai-recipe.schema';
import {
  type ExtractedRecipe,
  type ExtractedRecipeIngredient,
} from '../types/nutrition.types';
import { OLLAMA_PROVIDER, type OllamaProvider } from './ollama.provider';

const EXTRACTION_TIMEOUT_MS = 30_000;
const MAX_AI_ATTEMPTS = 2;

const SYSTEM_PROMPT = [
  'Extract recipe name, servings, and ingredients.',
  'Do not calculate calories.',
  'Do not invent ingredients.',
  'If quantity is missing, use null.',
  'If unit is missing, use "unknown".',
  'If preparation state is unknown, use "unknown".',
  'If uncertain about an ingredient, add a warning.',
  'Keep ingredient names in Vietnamese if the input is in Vietnamese.',
  'Return only data that matches the schema.',
].join('\n');

@Injectable()
export class AiRecipeExtractionService {
  private readonly logger = new Logger(AiRecipeExtractionService.name);

  constructor(
    @Inject(OLLAMA_PROVIDER) private readonly ollama: OllamaProvider,
    private readonly config: ConfigService,
  ) {}

  async extractRecipe(recipeText: string): Promise<ExtractedRecipe> {
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

    try {
      const result = await generateObject({
        model: this.ollama.chatModel(
          this.config.get<string>('OLLAMA_MODEL') ?? 'qwen2.5:7b',
        ),
        schema: extractedRecipeSchema,
        system: SYSTEM_PROMPT,
        prompt: recipeText,
        abortSignal: controller.signal,
        maxRetries: 0,
      });

      return extractedRecipeSchema.parse(result.object);
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeRecipe(recipe: AiExtractedRecipe): ExtractedRecipe {
    const ingredients: ExtractedRecipeIngredient[] = recipe.ingredients.map(
      (ingredient) => ({
        ...ingredient,
        unit: ingredient.unit ?? 'unknown',
        preparation: ingredient.preparation ?? 'unknown',
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
