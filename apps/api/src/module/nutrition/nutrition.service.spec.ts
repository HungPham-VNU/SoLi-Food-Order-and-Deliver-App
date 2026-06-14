import { NutritionService } from './nutrition.service';
import { UnitConversionService } from './matching/unit-conversion.service';
import { IngredientMatchingService } from './matching/ingredient-matching.service';
import { NutritionCalculatorService } from './calculator/nutrition-calculator.service';
import type { NutritionFood } from './domain/nutrition.schema';

const menuItemId = '11111111-1111-4111-8111-111111111111';
const restaurantId = '22222222-2222-4222-8222-222222222222';
const analysisSessionId = '33333333-3333-4333-8333-333333333333';

function makeFood(overrides: Partial<NutritionFood> = {}): NutritionFood {
  return {
    id: 'food-1',
    nameVi: 'uc ga',
    nameEn: 'chicken breast',
    aliases: ['uc ga', 'chicken breast'],
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

describe('NutritionService', () => {
  it('calculates nutrition from bounded DB candidates instead of loading all foods', async () => {
    const chicken = makeFood();
    const rice = makeFood({
      id: 'food-2',
      nameVi: 'com trang',
      nameEn: 'cooked white rice',
      aliases: ['com trang', 'white rice'],
      category: 'grain',
      state: 'cooked',
      calories100g: 130,
      protein100g: 2.4,
      carbs100g: 28.2,
      fat100g: 0.3,
    });

    const repo = {
      findSessionById: jest.fn().mockResolvedValue({
        id: analysisSessionId,
        menuItemId,
        restaurantId,
        inputType: 'text',
        rawRecipeText: '',
        aiExtractedJson: null,
        status: 'ANALYZED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      searchNutritionFoodsForIngredient: jest
        .fn()
        .mockImplementation(({ name }: { name: string }) =>
          Promise.resolve(name === 'uc ga' ? [chicken] : [rice]),
        ),
      listNutritionFoods: jest.fn(),
      replaceSessionIngredients: jest.fn().mockResolvedValue(undefined),
      updateCalculatedSession: jest.fn().mockResolvedValue(undefined),
    };

    const service = new NutritionService(
      {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: menuItemId, restaurantId }),
      } as any,
      {} as any,
      {} as any,
      repo as any,
      new UnitConversionService(),
      new IngredientMatchingService(),
      new NutritionCalculatorService(),
    );

    const result = await service.calculateNutrition(
      menuItemId,
      'admin-user',
      true,
      {
        analysisSessionId,
        servings: 2,
        ingredients: [
          {
            name: 'uc ga',
            quantity: 100,
            unit: 'g',
            preparation: 'raw',
          },
          {
            name: 'com trang',
            quantity: 200,
            unit: 'g',
            preparation: 'cooked',
          },
        ],
      },
    );

    expect(repo.searchNutritionFoodsForIngredient).toHaveBeenCalledTimes(2);
    expect(repo.searchNutritionFoodsForIngredient).toHaveBeenNthCalledWith(1, {
      name: 'uc ga',
      preferredState: 'raw',
    });
    expect(repo.searchNutritionFoodsForIngredient).toHaveBeenNthCalledWith(2, {
      name: 'com trang',
      preferredState: 'cooked',
    });
    expect(repo.listNutritionFoods).not.toHaveBeenCalled();
    expect(result.matchedIngredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inputName: 'uc ga',
          matchedFoodId: 'food-1',
        }),
        expect.objectContaining({
          inputName: 'com trang',
          matchedFoodId: 'food-2',
        }),
      ]),
    );
    expect(result.nutrition.total).toMatchObject({
      calories: 380,
      protein: 27.3,
      carbs: 56.4,
      fat: 3.2,
    });
  });
});
