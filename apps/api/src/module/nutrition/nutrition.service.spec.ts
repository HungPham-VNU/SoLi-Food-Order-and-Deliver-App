import { NutritionService } from './nutrition.service';
import { UnitConversionService } from './matching/unit-conversion.service';
import { IngredientMatchingService } from './matching/ingredient-matching.service';
import { NutritionCalculatorService } from './calculator/nutrition-calculator.service';
import type { NutritionFood } from './domain/nutrition.schema';
import type { ExtractedRecipe } from './types/nutrition.types';

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
  it('marks extraction-provided confirmation notes as needing review', async () => {
    const extractedRecipe: ExtractedRecipe = {
      recipeName: 'Bun cha',
      servings: 2,
      ingredients: [
        {
          rawText: 'vai nhanh mui tau',
          name: 'mui tau',
          quantity: 3,
          unit: 'piece',
          preparation: 'raw',
          category: 'main',
          confidence: 0.9,
          requiresConfirmation: true,
          notes: [
            'Approximate household quantity inferred for mui tau. Please confirm.',
          ],
        },
      ],
      warnings: [],
    };
    const repo = {
      createSession: jest.fn().mockResolvedValue({
        id: analysisSessionId,
        menuItemId,
        restaurantId,
        inputType: 'text',
        rawRecipeText: 'Bun cha',
        aiExtractedJson: extractedRecipe,
        status: 'NEEDS_REVIEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      insertIngredients: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NutritionService(
      {
        findOne: jest.fn().mockResolvedValue({ id: menuItemId, restaurantId }),
      } as any,
      {} as any,
      {
        extractRecipe: jest.fn().mockResolvedValue(extractedRecipe),
      } as any,
      repo as any,
      new UnitConversionService(),
      new IngredientMatchingService(),
      new NutritionCalculatorService(),
    );

    const result = await service.analyzeRecipe(menuItemId, 'admin-user', true, {
      recipeText: 'Bun cha',
    });

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.warnings).toContain(
      'Approximate household quantity inferred for mui tau. Please confirm.',
    );
    expect(result.ingredients[0]).toMatchObject({
      requiresConfirmation: true,
      notes: [
        'Approximate household quantity inferred for mui tau. Please confirm.',
      ],
    });
    expect(repo.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'NEEDS_REVIEW',
      }),
    );
  });

  it('does not force measurement or preparation for unquantified seasonings and rau', async () => {
    const extractedRecipe: ExtractedRecipe = {
      recipeName: 'Com tam',
      servings: 2,
      ingredients: [
        {
          rawText: 'muoi tieu',
          name: 'muoi',
          quantity: null,
          unit: 'unknown',
          preparation: 'unknown',
          category: 'seasoning',
          confidence: 0.95,
        },
        {
          rawText: 'rau song an kem',
          name: 'rau song',
          quantity: null,
          unit: 'unknown',
          preparation: 'unknown',
          category: 'herb_side',
          confidence: 0.95,
        },
      ],
      warnings: [],
    };
    const repo = {
      createSession: jest.fn().mockResolvedValue({
        id: analysisSessionId,
        menuItemId,
        restaurantId,
        inputType: 'text',
        rawRecipeText: 'Com tam',
        aiExtractedJson: extractedRecipe,
        status: 'ANALYZED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      insertIngredients: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NutritionService(
      {
        findOne: jest.fn().mockResolvedValue({ id: menuItemId, restaurantId }),
      } as any,
      {} as any,
      {
        extractRecipe: jest.fn().mockResolvedValue(extractedRecipe),
      } as any,
      repo as any,
      new UnitConversionService(),
      new IngredientMatchingService(),
      new NutritionCalculatorService(),
    );

    const result = await service.analyzeRecipe(menuItemId, 'admin-user', true, {
      recipeText: 'Com tam',
    });

    expect(result.status).toBe('ANALYZED');
    expect(result.warnings).toEqual([]);
    expect(result.ingredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'muoi',
          preparation: null,
          category: 'seasoning',
          measurementRequired: false,
          preparationApplicable: false,
          requiresConfirmation: false,
        }),
        expect.objectContaining({
          name: 'rau song',
          preparation: null,
          category: 'herb_side',
          measurementRequired: false,
          preparationApplicable: false,
          requiresConfirmation: false,
        }),
      ]),
    );
  });

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
        findOne: jest.fn().mockResolvedValue({ id: menuItemId, restaurantId }),
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
            category: 'main',
          },
          {
            name: 'com trang',
            quantity: 200,
            unit: 'g',
            preparation: 'cooked',
            category: 'main',
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

  it('omits optional unmeasured rows from calculation without missing quantity warnings', async () => {
    const chicken = makeFood();

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
        .mockResolvedValue([chicken]),
      replaceSessionIngredients: jest.fn().mockResolvedValue(undefined),
      updateCalculatedSession: jest.fn().mockResolvedValue(undefined),
    };

    const service = new NutritionService(
      {
        findOne: jest.fn().mockResolvedValue({ id: menuItemId, restaurantId }),
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
            category: 'main',
          },
          {
            name: 'muoi',
            quantity: null,
            unit: 'unknown',
            preparation: null,
            category: 'seasoning',
          },
          {
            name: 'rau song',
            quantity: null,
            unit: 'unknown',
            preparation: null,
            category: 'herb_side',
          },
        ],
      },
    );

    expect(repo.searchNutritionFoodsForIngredient).toHaveBeenCalledTimes(1);
    expect(result.matchedIngredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inputName: 'muoi',
          quantityGram: null,
          requiresConfirmation: false,
          excludedFromCalculation: true,
          warnings: [],
        }),
        expect.objectContaining({
          inputName: 'rau song',
          quantityGram: null,
          requiresConfirmation: false,
          excludedFromCalculation: true,
          warnings: [],
        }),
      ]),
    );
    const warningText = result.warnings.join('\n');
    expect(warningText).not.toContain('Quantity is missing for muoi');
    expect(warningText).not.toContain('muoi was excluded');
    expect(warningText).not.toContain('rau song was excluded');
    expect(result.nutrition.total).toMatchObject({
      calories: 120,
      protein: 22.5,
      carbs: 0,
      fat: 2.6,
    });
  });
});
