import { BadRequestException, Injectable } from '@nestjs/common';
import type { NutritionFood } from '../domain/nutrition.schema';
import type { NutritionTotals } from '../types/nutrition.types';

export interface NutritionCalculationIngredient {
  inputName: string;
  quantityGram: number | null;
  food: NutritionFood | null;
}

export interface NutritionCalculationResult {
  nutrition: NutritionTotals;
  warnings: string[];
}

@Injectable()
export class NutritionCalculatorService {
  calculate(
    servings: number,
    ingredients: NutritionCalculationIngredient[],
  ): NutritionCalculationResult {
    if (!servings || servings <= 0) {
      throw new BadRequestException('Servings are required for calculation.');
    }

    const warnings: string[] = [];
    const total = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: null as number | null,
      sugar: null as number | null,
      sodium: null as number | null,
    };

    for (const ingredient of ingredients) {
      if (!ingredient.food || ingredient.quantityGram === null) {
        warnings.push(
          `${ingredient.inputName} was excluded from nutrition calculation because it is missing a matched food or gram quantity.`,
        );
        continue;
      }

      const factor = ingredient.quantityGram / 100;
      total.calories += ingredient.food.calories100g * factor;
      total.protein += ingredient.food.protein100g * factor;
      total.carbs += ingredient.food.carbs100g * factor;
      total.fat += ingredient.food.fat100g * factor;
      total.fiber = this.addNullable(
        total.fiber,
        ingredient.food.fiber100g,
        factor,
      );
      total.sugar = this.addNullable(
        total.sugar,
        ingredient.food.sugar100g,
        factor,
      );
      total.sodium = this.addNullable(
        total.sodium,
        ingredient.food.sodium100g,
        factor,
      );
    }

    const roundedTotal = this.roundAmount(total);
    const perServing = this.roundAmount({
      calories: total.calories / servings,
      protein: total.protein / servings,
      carbs: total.carbs / servings,
      fat: total.fat / servings,
      fiber: total.fiber === null ? null : total.fiber / servings,
      sugar: total.sugar === null ? null : total.sugar / servings,
      sodium: total.sodium === null ? null : total.sodium / servings,
    });

    return {
      nutrition: {
        total: roundedTotal,
        perServing,
      },
      warnings,
    };
  }

  private addNullable(
    current: number | null,
    per100g: number | null,
    factor: number,
  ): number | null {
    if (per100g === null) return current;
    return (current ?? 0) + per100g * factor;
  }

  private roundAmount(amount: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number | null;
    sugar: number | null;
    sodium: number | null;
  }) {
    return {
      calories: Math.round(amount.calories),
      protein: this.roundMacro(amount.protein),
      carbs: this.roundMacro(amount.carbs),
      fat: this.roundMacro(amount.fat),
      fiber: amount.fiber === null ? null : this.roundMacro(amount.fiber),
      sugar: amount.sugar === null ? null : this.roundMacro(amount.sugar),
      sodium: amount.sodium === null ? null : Math.round(amount.sodium),
    };
  }

  private roundMacro(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
