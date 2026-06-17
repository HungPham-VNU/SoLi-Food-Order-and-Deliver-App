import { Injectable } from '@nestjs/common';
import { NutritionRepository } from '../repositories/nutrition.repository';

export type IngredientCanonicalizationSource = 'cache' | 'provided' | 'input';

export interface IngredientCanonicalizationInput {
  name: string;
  locale: string;
  canonicalNameEn?: string | null;
  canonicalNameConfidence?: number | null;
}

export interface IngredientCanonicalizationResult {
  englishName: string;
  confidence: number;
  source: IngredientCanonicalizationSource;
  nutritionFoodId: string | null;
}

export interface RememberIngredientAliasInput {
  name: string;
  locale: string;
  englishName: string;
  nutritionFoodId?: string | null;
  confidence: number;
  createdBy: string;
}

@Injectable()
export class IngredientCanonicalizerService {
  constructor(private readonly repo: NutritionRepository) {}

  async canonicalize(
    input: IngredientCanonicalizationInput,
  ): Promise<IngredientCanonicalizationResult | null> {
    const locale = this.normalizeLocale(input.locale);
    const normalizedName = this.normalizeName(input.name);
    if (!normalizedName) return null;

    const cached = await this.repo.findNutritionIngredientAlias({
      locale,
      normalizedName,
    });
    if (cached?.englishName) {
      return {
        englishName: cached.englishName,
        confidence: cached.confidence,
        source: 'cache',
        nutritionFoodId: cached.nutritionFoodId,
      };
    }

    const providedEnglishName = this.cleanEnglishName(input.canonicalNameEn);
    if (providedEnglishName) {
      return {
        englishName: providedEnglishName,
        confidence: this.normalizeConfidence(
          input.canonicalNameConfidence,
          0.6,
        ),
        source: 'provided',
        nutritionFoodId: null,
      };
    }

    if (this.isEnglishLocale(locale) && this.looksLikeEnglishName(input.name)) {
      return {
        englishName: input.name.trim().replace(/\s+/g, ' ').slice(0, 120),
        confidence: 1,
        source: 'input',
        nutritionFoodId: null,
      };
    }

    return null;
  }

  async remember(input: RememberIngredientAliasInput): Promise<void> {
    const locale = this.normalizeLocale(input.locale);
    const normalizedName = this.normalizeName(input.name);
    const englishName = this.cleanEnglishName(input.englishName);
    if (!normalizedName || !englishName) return;

    await this.repo.upsertNutritionIngredientAlias({
      locale,
      originalName: input.name.trim().replace(/\s+/g, ' ').slice(0, 120),
      normalizedName,
      englishName,
      nutritionFoodId: input.nutritionFoodId ?? null,
      confidence: this.normalizeConfidence(input.confidence, 0),
      createdBy: input.createdBy,
    });
  }

  normalizeName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 120);
  }

  normalizeLocale(value: string | null | undefined): string {
    const locale = (value ?? 'vi')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 16);

    return locale || 'vi';
  }

  private cleanEnglishName(value: string | null | undefined): string | null {
    if (!value) return null;

    const cleaned = value.trim().replace(/\s+/g, ' ').slice(0, 120);
    return cleaned.length > 0 ? cleaned : null;
  }

  private normalizeConfidence(
    value: number | null | undefined,
    fallback: number,
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;

    return Math.min(1, Math.max(0, value));
  }

  private isEnglishLocale(locale: string): boolean {
    return locale === 'en' || locale.startsWith('en-');
  }

  private looksLikeEnglishName(value: string): boolean {
    return /^[A-Za-z0-9\s,.'()-]+$/.test(value.trim());
  }
}
