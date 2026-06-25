import { Injectable } from '@nestjs/common';
import type { NutritionFood } from '../domain/nutrition.schema';
import type { PreparationState } from '../types/nutrition.types';

export type MatchableNutritionFood = NutritionFood & {
  localizedName?: string | null;
  localizedAliases?: string[] | null;
  localizedLocale?: string | null;
};

export interface IngredientMatchInput {
  name: string;
  preparation?: PreparationState;
}

export interface IngredientMatchCandidate {
  matchedFoodId: string;
  matchedName: string;
  matchedNameEn: string;
  state: NutritionFood['state'];
  matchConfidence: number;
}

export interface IngredientMatchResult {
  bestCandidate: IngredientMatchCandidate | null;
  candidates: IngredientMatchCandidate[];
  requiresConfirmation: boolean;
}

@Injectable()
export class IngredientMatchingService {
  matchIngredient(
    input: IngredientMatchInput,
    foods: MatchableNutritionFood[],
  ): IngredientMatchResult {
    const normalizedInput = this.normalize(input.name);
    const preferredState = this.resolvePreferredStateFromNormalized(
      normalizedInput,
      input.preparation ?? 'unknown',
    );

    const candidates = foods
      .map((food) => {
        const baseScore = this.scoreFood(normalizedInput, food);
        if (baseScore === 0) return null;

        const stateBoost =
          preferredState && food.state === preferredState ? 0.04 : 0;

        return {
          matchedFoodId: food.id,
          matchedName: food.localizedName ?? food.nameVi,
          matchedNameEn: food.nameEn,
          state: food.state,
          matchConfidence: Math.min(0.99, baseScore + stateBoost),
        };
      })
      .filter((candidate): candidate is IngredientMatchCandidate =>
        Boolean(candidate),
      )
      .sort((a, b) => b.matchConfidence - a.matchConfidence)
      .slice(0, 5);

    const bestCandidate = candidates[0] ?? null;
    const secondCandidate = candidates[1] ?? null;
    const closeSecond =
      bestCandidate && secondCandidate
        ? bestCandidate.matchConfidence - secondCandidate.matchConfidence < 0.1
        : false;

    return {
      bestCandidate,
      candidates,
      requiresConfirmation:
        !bestCandidate || bestCandidate.matchConfidence < 0.85 || closeSecond,
    };
  }

  isGenericIngredientName(name: string): boolean {
    const normalized = this.normalize(name);
    return ['thit', 'rau', 'sot', 'gia vi', 'bot'].includes(normalized);
  }

  resolvePreferredState(
    input: IngredientMatchInput,
  ): NutritionFood['state'] | null {
    return this.resolvePreferredStateFromNormalized(
      this.normalize(input.name),
      input.preparation ?? 'unknown',
    );
  }

  private scoreFood(
    normalizedInput: string,
    food: MatchableNutritionFood,
  ): number {
    const normalizedLocalizedName = food.localizedName
      ? this.normalize(food.localizedName)
      : null;
    const normalizedNameVi = this.normalize(food.nameVi);
    const normalizedNameEn = this.normalize(food.nameEn);
    const aliases = this.uniqueNormalized([
      ...(food.localizedAliases ?? []),
      ...food.aliases,
    ]);

    if (
      normalizedLocalizedName &&
      normalizedInput === normalizedLocalizedName
    ) {
      return 0.99;
    }
    if (normalizedInput === normalizedNameVi) return 0.98;
    if (normalizedInput === normalizedNameEn) return 0.94;
    if (aliases.includes(normalizedInput)) return 0.96;

    if (
      normalizedLocalizedName &&
      (normalizedLocalizedName.includes(normalizedInput) ||
        normalizedInput.includes(normalizedLocalizedName))
    ) {
      return 0.82;
    }

    if (
      normalizedNameVi.includes(normalizedInput) ||
      normalizedInput.includes(normalizedNameVi)
    ) {
      return 0.78;
    }

    if (
      normalizedNameEn.includes(normalizedInput) ||
      normalizedInput.includes(normalizedNameEn)
    ) {
      return 0.74;
    }

    if (
      aliases.some(
        (alias) =>
          alias.includes(normalizedInput) || normalizedInput.includes(alias),
      )
    ) {
      return 0.76;
    }

    const bestTokenOverlap = Math.max(
      normalizedLocalizedName
        ? this.tokenOverlapScore(normalizedInput, normalizedLocalizedName)
        : 0,
      this.tokenOverlapScore(normalizedInput, normalizedNameVi),
      this.tokenOverlapScore(normalizedInput, normalizedNameEn),
      ...aliases.map((alias) => this.tokenOverlapScore(normalizedInput, alias)),
    );
    if (bestTokenOverlap > 0) return bestTokenOverlap;

    const bestSimilarity = Math.max(
      normalizedLocalizedName
        ? this.similarity(normalizedInput, normalizedLocalizedName)
        : 0,
      this.similarity(normalizedInput, normalizedNameVi),
      this.similarity(normalizedInput, normalizedNameEn),
      ...aliases.map((alias) => this.similarity(normalizedInput, alias)),
    );

    return bestSimilarity >= 0.72 ? 0.55 + bestSimilarity * 0.25 : 0;
  }

  private resolvePreferredStateFromNormalized(
    normalizedName: string,
    preparation: PreparationState,
  ): NutritionFood['state'] | null {
    if (preparation === 'steamed') return 'cooked';
    if (preparation !== 'unknown') return preparation;
    if (normalizedName.includes('com')) return 'cooked';
    if (normalizedName.includes('gao')) return 'raw';
    return null;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
      .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
      .replace(/\s+/g, ' ');
  }

  private tokenOverlapScore(
    normalizedInput: string,
    normalizedFood: string,
  ): number {
    const inputTokens = this.tokenize(normalizedInput);
    if (inputTokens.length === 0) return 0;

    const foodTokens = new Set(this.tokenize(normalizedFood));
    if (!inputTokens.every((token) => foodTokens.has(token))) return 0;

    return Math.min(0.82, 0.68 + inputTokens.length * 0.05);
  }

  private tokenize(value: string): string[] {
    return value
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 1);
  }

  private uniqueNormalized(values: string[]): string[] {
    return Array.from(
      new Set(
        values
          .map((value) => this.normalize(value))
          .filter((value) => value.length >= 2),
      ),
    );
  }

  private similarity(left: string, right: string): number {
    if (!left || !right) return 0;
    const distance = this.levenshtein(left, right);
    return 1 - distance / Math.max(left.length, right.length);
  }

  private levenshtein(left: string, right: string): number {
    const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
    const current = Array.from({ length: right.length + 1 }, () => 0);

    for (let i = 1; i <= left.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + substitutionCost,
        );
      }
      previous.splice(0, previous.length, ...current);
    }

    return previous[right.length];
  }
}
