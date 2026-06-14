import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  extractedRecipeSchema,
  type AiExtractedRecipe,
} from './ai-recipe.schema';
import {
  type ExtractedRecipe,
  type ExtractedRecipeIngredient,
} from '../types/nutrition.types';
import {
  resolveOllamaRuntimeConfig,
  type OllamaRuntimeConfig,
} from './ollama.provider';

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
  'Return raw JSON only. Do not wrap the JSON in Markdown code fences.',
  'IMPORTANT: You must return a valid JSON object strictly following this structure and camelCase keys:',
  '{',
  '  "recipeName": "string | null",',
  '  "servings": "number | null",',
  '  "ingredients": [',
  '    {',
  '      "rawText": "string",',
  '      "name": "string",',
  '      "quantity": "number | null",',
  '      "unit": "g|ml|tsp|tbsp|cup|oz|lb|unknown",',
  '      "preparation": "raw|cooked|fried|boiled|grilled|unknown",',
  '      "confidence": "number between 0 and 1"',
  '    }',
  '  ],',
  '  "warnings": ["string"]',
  '}',
].join('\n');

@Injectable()
export class AiRecipeExtractionService {
  private readonly logger = new Logger(AiRecipeExtractionService.name);

  constructor(private readonly config: ConfigService) {}

  async extractRecipe(recipeText: string): Promise<ExtractedRecipe> {
    const runtimeConfig = this.getRuntimeConfig();

    if (!runtimeConfig.apiKey) {
      throw new ServiceUnavailableException({
        message:
          'AI analysis service is not configured. Set OLLAMA_API_KEY for Ollama Cloud.',
        cause: 'OLLAMA_API_KEY is required for direct Ollama Cloud API access.',
      });
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
      try {
        const object = await this.generate(recipeText, runtimeConfig);
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

  private async generate(
    recipeText: string,
    runtimeConfig: OllamaRuntimeConfig,
  ): Promise<AiExtractedRecipe> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

    try {
      return await this.generateWithCloudOllama(
        recipeText,
        runtimeConfig,
        controller.signal,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private getRuntimeConfig(): OllamaRuntimeConfig {
    return resolveOllamaRuntimeConfig({
      baseURL: this.config.get<string>('OLLAMA_BASE_URL'),
      apiKey: this.config.get<string>('OLLAMA_API_KEY'),
      model: this.config.get<string>('OLLAMA_MODEL'),
    });
  }

  private async generateWithCloudOllama(
    recipeText: string,
    runtimeConfig: OllamaRuntimeConfig,
    abortSignal: AbortSignal,
  ): Promise<AiExtractedRecipe> {
    const response = await fetch(`${runtimeConfig.endpoint.baseURL}/chat`, {
      method: 'POST',
      headers: this.ollamaHeaders(runtimeConfig),
      body: JSON.stringify({
        model: runtimeConfig.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: recipeText },
        ],
        stream: false,
        think: false,
        // Ollama Cloud does not currently support structured outputs. Validate
        // the prompt-shaped JSON locally after receiving the response.
        options: {
          temperature: 0,
        },
      }),
      signal: abortSignal,
    });
    const responseBody = await this.readOllamaResponse(response);

    if (!response.ok) {
      throw new Error(
        `Ollama Cloud API request failed (${response.status}): ${this.ollamaErrorMessage(
          responseBody,
          response.statusText,
        )}`,
      );
    }

    const content = responseBody.message?.content;
    if (!content) {
      throw new Error('Ollama Cloud API response did not include content.');
    }

    return extractedRecipeSchema.parse(this.parseOllamaContent(content));
  }

  private ollamaHeaders(
    runtimeConfig: OllamaRuntimeConfig,
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${runtimeConfig.apiKey}`,
    };
  }

  private async readOllamaResponse(
    response: Response,
  ): Promise<OllamaChatResponse> {
    const text = await response.text();
    if (!text.trim()) {
      return {};
    }

    try {
      return JSON.parse(text) as OllamaChatResponse;
    } catch {
      throw new Error(
        `Ollama Cloud API returned non-JSON response (${response.status}).`,
      );
    }
  }

  private ollamaErrorMessage(
    responseBody: OllamaChatResponse,
    fallback: string,
  ) {
    if (typeof responseBody.error === 'string') {
      return responseBody.error;
    }

    return fallback;
  }

  private parseOllamaContent(content: string): unknown {
    try {
      let cleaned = content.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '');
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.replace(/```$/, '');
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

    if (!('rawText' in normalized) && typeof normalized.name === 'string') {
      normalized.rawText = normalized.name;
    }
    if (!('name' in normalized) && typeof normalized.rawText === 'string') {
      normalized.name = normalized.rawText;
    }
    if (!('quantity' in normalized)) {
      normalized.quantity = null;
    }
    if (!('unit' in normalized)) {
      normalized.unit = 'unknown';
    }
    if (!('preparation' in normalized)) {
      normalized.preparation = 'unknown';
    }
    if (!('confidence' in normalized)) {
      normalized.confidence = 0.5;
    }

    return normalized;
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

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  error?: string;
}
