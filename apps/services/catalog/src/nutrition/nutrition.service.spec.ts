import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { NutritionService } from './nutrition.service';
import { UnitConversionService } from './matching/unit-conversion.service';
import { IngredientCanonicalizerService } from './matching/ingredient-canonicalizer.service';
import { IngredientMatchingService } from './matching/ingredient-matching.service';
import { NutritionIngredientResolutionService } from './matching/nutrition-ingredient-resolution.service';
import { NutritionCalculatorService } from './calculator/nutrition-calculator.service';
import type { NutritionFood } from './domain/nutrition.schema';
import type { NutritionRepository } from './repositories/nutrition.repository';
import type { ExtractedRecipe } from './types/nutrition.types';

const menuItemId = '11111111-1111-4111-8111-111111111111';
const restaurantId = '22222222-2222-4222-8222-222222222222';
const analysisSessionId = '33333333-3333-4333-8333-333333333333';

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: analysisSessionId,
    menuItemId,
    restaurantId,
    inputType: 'text',
    rawRecipeText: '',
    aiExtractedJson: null,
    status: 'ANALYZED',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeFood(overrides: Partial<NutritionFood> = {}): NutritionFood {
  return {
    id: 'food-1',
    nameVi: 'uc ga',
    nameEn: 'chicken breast',
    source: 'TEST',
    sourceFoodId: 'food-1',
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

function makeService(
  input: {
    menuService?: unknown;
    restaurantService?: unknown;
    aiExtraction?: unknown;
    repo?: Partial<NutritionRepository>;
    unitConversion?: UnitConversionService;
    ingredientMatching?: IngredientMatchingService;
    ingredientCanonicalizer?: IngredientCanonicalizerService;
    ingredientResolution?: NutritionIngredientResolutionService;
    calculator?: NutritionCalculatorService;
  } = {},
) {
  const repo = (input.repo ?? {}) as NutritionRepository;
  const unitConversion = input.unitConversion ?? new UnitConversionService();
  const ingredientMatching =
    input.ingredientMatching ?? new IngredientMatchingService();
  const ingredientCanonicalizer =
    input.ingredientCanonicalizer ?? new IngredientCanonicalizerService(repo);
  const ingredientResolution =
    input.ingredientResolution ??
    new NutritionIngredientResolutionService(
      repo,
      unitConversion,
      ingredientMatching,
      ingredientCanonicalizer,
    );

  return new NutritionService(
    input.menuService ?? {
      findOne: jest.fn().mockResolvedValue({ id: menuItemId, restaurantId }),
    },
    input.restaurantService ?? {},
    input.aiExtraction ?? {},
    repo,
    unitConversion,
    ingredientMatching,
    ingredientResolution,
    input.calculator ?? new NutritionCalculatorService(),
  );
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
    const service = makeService({
      aiExtraction: {
        extractRecipe: jest.fn().mockResolvedValue(extractedRecipe),
      },
      repo,
    });

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
    const service = makeService({
      aiExtraction: {
        extractRecipe: jest.fn().mockResolvedValue(extractedRecipe),
      },
      repo,
    });

    const result = await service.analyzeRecipe(menuItemId, 'admin-user', true, {
      recipeText: 'Com tam',
    });

    expect(result.status).toBe('ANALYZED');
    expect(result.warnings).toEqual([]);
    expect(result.ingredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'muoi',
          quantity: 0,
          preparation: null,
          category: 'seasoning',
          measurementRequired: false,
          preparationApplicable: false,
          requiresConfirmation: false,
        }),
        expect.objectContaining({
          name: 'rau song',
          quantity: 0,
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
      upsertNutritionIngredientAlias: jest.fn().mockResolvedValue(undefined),
      replaceSessionIngredients: jest.fn().mockResolvedValue(undefined),
      updateCalculatedSession: jest.fn().mockResolvedValue(undefined),
    };

    const service = makeService({ repo });

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
      locale: 'vi',
      preferredState: 'raw',
    });
    expect(repo.searchNutritionFoodsForIngredient).toHaveBeenNthCalledWith(2, {
      name: 'com trang',
      locale: 'vi',
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
      searchNutritionFoodsForIngredient: jest.fn().mockResolvedValue([chicken]),
      upsertNutritionIngredientAlias: jest.fn().mockResolvedValue(undefined),
      replaceSessionIngredients: jest.fn().mockResolvedValue(undefined),
      updateCalculatedSession: jest.fn().mockResolvedValue(undefined),
    };

    const service = makeService({ repo });

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
            quantity: 0,
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

  it('falls back to an English canonical ingredient name when localized search misses', async () => {
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
        .mockImplementation(
          ({ name, locale }: { name: string; locale: string }) =>
            Promise.resolve(
              name === 'chicken breast' && locale === 'en' ? [chicken] : [],
            ),
        ),
      findNutritionIngredientAlias: jest.fn().mockResolvedValue(null),
      upsertNutritionIngredientAlias: jest.fn().mockResolvedValue(undefined),
      replaceSessionIngredients: jest.fn().mockResolvedValue(undefined),
      updateCalculatedSession: jest.fn().mockResolvedValue(undefined),
    };
    const service = makeService({ repo });

    const result = await service.calculateNutrition(
      menuItemId,
      'admin-user',
      true,
      {
        analysisSessionId,
        servings: 1,
        ingredients: [
          {
            name: 'thịt gà',
            canonicalNameEn: 'chicken breast',
            canonicalNameConfidence: 0.95,
            quantity: 100,
            unit: 'g',
            preparation: 'raw',
            category: 'main',
          },
        ],
      },
    );

    expect(repo.searchNutritionFoodsForIngredient).toHaveBeenNthCalledWith(1, {
      name: 'thịt gà',
      locale: 'vi',
      preferredState: 'raw',
    });
    expect(repo.searchNutritionFoodsForIngredient).toHaveBeenNthCalledWith(2, {
      name: 'chicken breast',
      locale: 'en',
      preferredState: 'raw',
    });
    expect(result.matchedIngredients[0]).toMatchObject({
      inputName: 'thịt gà',
      matchedFoodId: 'food-1',
      requiresConfirmation: false,
    });
    expect(repo.upsertNutritionIngredientAlias).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'vi',
        normalizedName: 'thit ga',
        englishName: 'chicken breast',
        nutritionFoodId: 'food-1',
        createdBy: 'AI_CANONICALIZED',
      }),
    );
  });

  it('uses restaurant-selected nutrition food ids as confirmed mappings', async () => {
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
      findNutritionFoodById: jest.fn().mockResolvedValue(chicken),
      searchNutritionFoodsForIngredient: jest.fn(),
      upsertNutritionIngredientAlias: jest.fn().mockResolvedValue(undefined),
      replaceSessionIngredients: jest.fn().mockResolvedValue(undefined),
      updateCalculatedSession: jest.fn().mockResolvedValue(undefined),
    };
    const service = makeService({ repo });

    const result = await service.calculateNutrition(
      menuItemId,
      'admin-user',
      true,
      {
        analysisSessionId,
        servings: 1,
        ingredients: [
          {
            name: 'thịt gà',
            matchedNutritionFoodId: 'food-1',
            quantity: 100,
            unit: 'g',
            preparation: 'raw',
            category: 'main',
          },
        ],
      },
    );

    expect(repo.searchNutritionFoodsForIngredient).not.toHaveBeenCalled();
    expect(result.matchedIngredients[0]).toMatchObject({
      matchedFoodId: 'food-1',
      requiresConfirmation: false,
    });
    expect(repo.upsertNutritionIngredientAlias).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'vi',
        normalizedName: 'thit ga',
        englishName: 'chicken breast',
        nutritionFoodId: 'food-1',
        createdBy: 'RESTAURANT_CONFIRMED',
      }),
    );
  });

  it('persists a failed analysis response when AI extraction fails', async () => {
    const repo = {
      createSession: jest
        .fn()
        .mockResolvedValue(makeSession({ status: 'FAILED' })),
    };
    const service = makeService({
      aiExtraction: {
        extractRecipe: jest.fn().mockRejectedValue(new Error('AI offline')),
      },
      repo,
    });

    const result = await service.analyzeRecipe(menuItemId, 'admin-user', true, {
      recipeText: '  Bun cha\0 text  ',
    });

    expect(repo.createSession).toHaveBeenCalledWith({
      menuItemId,
      restaurantId,
      inputType: 'text',
      rawRecipeText: 'Bun cha text',
      aiExtractedJson: null,
      status: 'FAILED',
    });
    expect(result).toEqual({
      analysisSessionId,
      recipeName: null,
      servings: null,
      ingredients: [],
      warnings: [
        'AI analysis service is currently unavailable. Please try again or enter ingredients manually.',
      ],
      status: 'FAILED',
    });
  });

  it('hydrates latest analysis from extracted JSON when no ingredient rows exist', async () => {
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
          requiresConfirmation: false,
          notes: [],
        },
      ],
      warnings: ['Confirm serving size.'],
    };
    const repo = {
      findLatestEditableAnalysisByMenuItemId: jest.fn().mockResolvedValue(
        makeSession({
          rawRecipeText: 'Com tam recipe',
          aiExtractedJson: extractedRecipe,
          status: 'NEEDS_REVIEW',
        }),
      ),
      listIngredientsBySessionId: jest.fn().mockResolvedValue([]),
    };
    const service = makeService({ repo });

    const result = await service.getLatestMenuItemNutritionAnalysis(
      menuItemId,
      'admin-user',
      true,
    );

    expect(result).toMatchObject({
      analysisSessionId,
      recipeName: 'Com tam',
      recipeText: 'Com tam recipe',
      servings: 2,
      warnings: ['Confirm serving size.'],
      status: 'NEEDS_REVIEW',
    });
    expect(result?.ingredients).toEqual([
      expect.objectContaining({
        name: 'muoi',
        quantity: 0,
        preparation: null,
        measurementRequired: false,
        preparationApplicable: false,
      }),
    ]);
  });

  it('rejects non-owners before reading nutrition analysis data', async () => {
    const repo = {
      findLatestEditableAnalysisByMenuItemId: jest.fn(),
    };
    const service = makeService({
      restaurantService: {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: restaurantId, ownerId: 'owner-1' }),
      },
      repo,
    });

    await expect(
      service.getLatestMenuItemNutritionAnalysis(menuItemId, 'owner-2', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.findLatestEditableAnalysisByMenuItemId).not.toHaveBeenCalled();
  });

  it('rejects calculate requests for sessions from another menu item', async () => {
    const repo = {
      findSessionById: jest.fn().mockResolvedValue(
        makeSession({
          menuItemId: '44444444-4444-4444-8444-444444444444',
        }),
      ),
      searchNutritionFoodsForIngredient: jest.fn(),
    };
    const service = makeService({ repo });

    await expect(
      service.calculateNutrition(menuItemId, 'admin-user', true, {
        analysisSessionId,
        servings: 1,
        ingredients: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.searchNutritionFoodsForIngredient).not.toHaveBeenCalled();
  });

  it('requires restaurant verification before saving nutrition', async () => {
    const repo = {
      findSessionById: jest.fn(),
      saveMenuItemNutrition: jest.fn(),
    };
    const service = makeService({ repo });

    await expect(
      service.saveMenuItemNutrition(menuItemId, 'admin-user', true, {
        analysisSessionId,
        servings: 1,
        nutrition: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
        ingredients: [],
        verifiedByRestaurant: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.findSessionById).not.toHaveBeenCalled();
    expect(repo.saveMenuItemNutrition).not.toHaveBeenCalled();
  });

  it('starts an empty manual ingredient session without AI extraction', async () => {
    const repo = {
      createSession: jest.fn().mockResolvedValue(
        makeSession({
          inputType: 'manual',
          status: 'NEEDS_REVIEW',
          aiExtractedJson: {
            recipeName: null,
            servings: 1,
            ingredients: [],
            warnings: [],
          },
        }),
      ),
    };
    const aiExtraction = { extractRecipe: jest.fn() };
    const service = makeService({ repo, aiExtraction });

    const result = await service.startManualIngredientSession(
      menuItemId,
      'admin-user',
      true,
    );

    expect(aiExtraction.extractRecipe).not.toHaveBeenCalled();
    expect(repo.createSession).toHaveBeenCalledWith({
      menuItemId,
      restaurantId,
      inputType: 'manual',
      rawRecipeText: '',
      aiExtractedJson: {
        recipeName: null,
        servings: 1,
        ingredients: [],
        warnings: [],
      },
      status: 'NEEDS_REVIEW',
    });
    expect(result).toMatchObject({
      analysisSessionId,
      servings: 1,
      ingredients: [],
      status: 'NEEDS_REVIEW',
    });
  });

  it('rejects saving before the ingredient calculation has completed', async () => {
    const repo = {
      findSessionById: jest.fn().mockResolvedValue(makeSession()),
      listIngredientsBySessionId: jest.fn(),
      saveMenuItemNutrition: jest.fn(),
    };
    const service = makeService({ repo });

    await expect(
      service.saveMenuItemNutrition(menuItemId, 'admin-user', true, {
        analysisSessionId,
        verifiedByRestaurant: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.listIngredientsBySessionId).not.toHaveBeenCalled();
    expect(repo.saveMenuItemNutrition).not.toHaveBeenCalled();
  });

  it('saves verified nutrition and marks the analysis session saved', async () => {
    const savedNutrition = {
      menuItemId,
      servings: 2,
      calories: 120,
      protein: 22.5,
      carbs: 0,
      fat: 2.6,
      fiber: null,
      sugar: null,
      sodium: null,
      source: 'AI_ESTIMATED',
      verifiedByRestaurant: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repo = {
      findSessionById: jest.fn().mockResolvedValue(
        makeSession({
          status: 'CALCULATED',
          aiExtractedJson: {
            recipeName: 'Chicken',
            servings: 2,
            ingredients: [],
            warnings: [],
          },
        }),
      ),
      listIngredientsBySessionId: jest.fn().mockResolvedValue([
        {
          correctedName: 'uc ga',
          extractedName: 'uc ga',
          quantityGram: 200,
          matchedNutritionFoodId: 'food-1',
        },
      ]),
      findNutritionFoodById: jest.fn().mockResolvedValue(makeFood()),
      saveMenuItemNutrition: jest.fn().mockResolvedValue(savedNutrition),
    };
    const service = makeService({ repo });

    const result = await service.saveMenuItemNutrition(
      menuItemId,
      'admin-user',
      true,
      {
        analysisSessionId,
        verifiedByRestaurant: true,
      },
    );

    expect(repo.saveMenuItemNutrition).toHaveBeenCalledWith(
      {
        menuItemId,
        servings: 2,
        calories: 120,
        protein: 22.5,
        carbs: 0,
        fat: 2.6,
        fiber: null,
        sugar: null,
        sodium: null,
        source: 'AI_ESTIMATED',
        verifiedByRestaurant: true,
      },
      {
        analysisSessionId,
      },
    );
    expect(result).toMatchObject({
      servings: 2,
      calories: 120,
      protein: 22.5,
      carbs: 0,
      fat: 2.6,
      verifiedByRestaurant: true,
    });
  });

  it('marks nutrition calculated from manual ingredients with the manual source', async () => {
    const savedNutrition = {
      menuItemId,
      servings: 1,
      calories: 120,
      protein: 22.5,
      carbs: 0,
      fat: 2.6,
      fiber: null,
      sugar: null,
      sodium: null,
      source: 'MANUALLY_ENTERED',
      verifiedByRestaurant: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repo = {
      findSessionById: jest.fn().mockResolvedValue(
        makeSession({
          inputType: 'manual',
          status: 'CALCULATED',
          aiExtractedJson: {
            recipeName: null,
            servings: 1,
            ingredients: [],
            warnings: [],
          },
        }),
      ),
      listIngredientsBySessionId: jest.fn().mockResolvedValue([
        {
          correctedName: 'uc ga',
          extractedName: 'uc ga',
          quantityGram: 100,
          matchedNutritionFoodId: 'food-1',
        },
      ]),
      findNutritionFoodById: jest.fn().mockResolvedValue(makeFood()),
      saveMenuItemNutrition: jest.fn().mockResolvedValue(savedNutrition),
    };
    const service = makeService({ repo });

    await service.saveMenuItemNutrition(menuItemId, 'admin-user', true, {
      analysisSessionId,
      verifiedByRestaurant: true,
    });

    expect(repo.saveMenuItemNutrition).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'MANUALLY_ENTERED' }),
      expect.any(Object),
    );
  });
});
