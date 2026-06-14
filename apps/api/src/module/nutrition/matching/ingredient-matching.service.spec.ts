import { IngredientMatchingService } from './ingredient-matching.service';
import type { NutritionFood } from '../domain/nutrition.schema';

function makeFood(overrides: Partial<NutritionFood>): NutritionFood {
  return {
    id: 'food-1',
    nameVi: 'ức gà',
    nameEn: 'chicken breast',
    aliases: ['uc ga'],
    category: 'meat',
    state: 'raw',
    calories100g: 120,
    protein100g: 22.5,
    carbs100g: 0,
    fat100g: 2.6,
    fiber100g: null,
    sugar100g: null,
    sodium100g: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('IngredientMatchingService', () => {
  let service: IngredientMatchingService;

  beforeEach(() => {
    service = new IngredientMatchingService();
  });

  it('matches exact Vietnamese names', () => {
    const result = service.matchIngredient({ name: 'ức gà' }, [makeFood({})]);

    expect(result.bestCandidate?.matchedFoodId).toBe('food-1');
    expect(result.bestCandidate?.matchConfidence).toBeGreaterThanOrEqual(0.95);
  });

  it('matches aliases without accents', () => {
    const result = service.matchIngredient({ name: 'uc ga' }, [makeFood({})]);

    expect(result.bestCandidate?.matchedName).toBe('ức gà');
    expect(result.requiresConfirmation).toBe(false);
  });

  it('uses preparation to prefer cooked state variants', () => {
    const foods = [
      makeFood({
        id: 'rice-raw',
        nameVi: 'cơm trắng',
        nameEn: 'white rice raw-like test',
        aliases: ['com trang'],
        state: 'raw',
      }),
      makeFood({
        id: 'rice-cooked',
        nameVi: 'cơm trắng',
        nameEn: 'cooked white rice',
        aliases: ['com trang'],
        state: 'cooked',
      }),
    ];

    const result = service.matchIngredient(
      { name: 'com trang', preparation: 'cooked' },
      foods,
    );

    expect(result.bestCandidate?.matchedFoodId).toBe('rice-cooked');
  });

  it('matches USDA comma-separated descriptions by token overlap', () => {
    const description = 'Chicken, broilers or fryers, breast, meat only, raw';
    const result = service.matchIngredient(
      { name: 'chicken breast', preparation: 'raw' },
      [
        makeFood({
          id: 'usda-chicken-breast',
          nameVi: description,
          nameEn: description,
          aliases: ['chicken broilers or fryers breast meat only raw'],
          state: 'raw',
        }),
      ],
    );

    expect(result.bestCandidate?.matchedFoodId).toBe('usda-chicken-breast');
    expect(result.bestCandidate?.matchConfidence).toBeGreaterThanOrEqual(0.8);
    expect(result.requiresConfirmation).toBe(true);
  });

  it('flags generic ingredient names', () => {
    expect(service.isGenericIngredientName('thịt')).toBe(true);
    expect(service.isGenericIngredientName('uc ga')).toBe(false);
  });

  it('returns no candidate when similarity is too low', () => {
    const result = service.matchIngredient({ name: 'coffee beans' }, [
      makeFood({}),
    ]);

    expect(result.bestCandidate).toBeNull();
    expect(result.requiresConfirmation).toBe(true);
  });
});
