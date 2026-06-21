import { BadRequestException } from '@nestjs/common';
import { NutritionCalculatorService } from './nutrition-calculator.service';
import type { NutritionFood } from '../domain/nutrition.schema';

function makeFood(overrides: Partial<NutritionFood> = {}): NutritionFood {
  return {
    id: 'food-1',
    nameVi: 'ức gà',
    nameEn: 'chicken breast',
    source: 'TEST',
    sourceFoodId: 'food-1',
    aliases: ['uc ga'],
    category: 'meat',
    state: 'raw',
    calories100g: 120,
    protein100g: 22.5,
    carbs100g: 0,
    fat100g: 2.6,
    fiber100g: null,
    sugar100g: null,
    sodium100g: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('NutritionCalculatorService', () => {
  let service: NutritionCalculatorService;

  beforeEach(() => {
    service = new NutritionCalculatorService();
  });

  it('calculates total and per-serving nutrition with display rounding', () => {
    const result = service.calculate(2, [
      {
        inputName: 'uc ga',
        quantityGram: 250,
        food: makeFood(),
      },
      {
        inputName: 'com trang',
        quantityGram: 300,
        food: makeFood({
          id: 'rice',
          calories100g: 130,
          protein100g: 2.4,
          carbs100g: 28.2,
          fat100g: 0.3,
          sodium100g: 1,
        }),
      },
    ]);

    expect(result.nutrition.total).toMatchObject({
      calories: 690,
      protein: 63.5,
      carbs: 84.6,
      fat: 7.4,
      sodium: 128,
    });
    expect(result.nutrition.perServing).toMatchObject({
      calories: 345,
      protein: 31.7,
      carbs: 42.3,
      fat: 3.7,
      sodium: 64,
    });
  });

  it('excludes ingredients missing a food or gram quantity and returns warnings', () => {
    const result = service.calculate(1, [
      {
        inputName: 'unknown sauce',
        quantityGram: null,
        food: null,
      },
    ]);

    expect(result.nutrition.total.calories).toBe(0);
    expect(result.warnings).toHaveLength(1);
  });

  it('blocks calculation when servings are missing or zero', () => {
    expect(() => service.calculate(0, [])).toThrow(BadRequestException);
  });
});
