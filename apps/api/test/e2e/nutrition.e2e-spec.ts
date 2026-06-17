import { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AiRecipeExtractionService } from '../../src/module/nutrition/ai/ai-recipe-extraction.service';
import {
  nutritionAnalysisIngredients,
  nutritionAnalysisSessions,
} from '../../src/module/nutrition/domain/nutrition.schema';
import {
  NUTRITION_DISCLAIMER,
  type ExtractedRecipe,
} from '../../src/module/nutrition/types/nutrition.types';
import { ownerHeaders, setAuthManager } from '../helpers/auth';
import { TestAuthManager } from '../helpers/test-auth';
import { createTestApp, teardownTestApp } from '../setup/app-factory';
import {
  getTestDb,
  resetDb,
  seedBaseRestaurant,
  TEST_RESTAURANT_ID,
} from '../setup/db-setup';

describe('AI Nutrition Analyzer (E2E)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let extractRecipeMock: jest.SpiedFunction<
    AiRecipeExtractionService['extractRecipe']
  >;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());

    await resetDb();

    const testAuth = new TestAuthManager();
    await testAuth.initialize(http);
    setAuthManager(testAuth);

    await seedBaseRestaurant(testAuth.ownerUserId);

    const aiExtraction = app.get(AiRecipeExtractionService);
    extractRecipeMock = jest.spyOn(aiExtraction, 'extractRecipe');
  });

  afterEach(() => {
    extractRecipeMock.mockReset();
  });

  afterAll(async () => {
    extractRecipeMock.mockRestore();
    await teardownTestApp(app);
  });

  it('analyzes a recipe, applies review rules, and persists the analysis session', async () => {
    const menuItemId = await createMenuItem('E2E Com ga xoi mo');
    const extractedRecipe: ExtractedRecipe = {
      recipeName: 'Com ga xoi mo',
      servings: 2,
      ingredients: [
        {
          rawText: '500g uc ga',
          name: 'uc ga',
          quantity: 500,
          unit: 'g',
          preparation: 'cooked',
          confidence: 0.96,
        },
        {
          rawText: '300g com trang',
          name: 'com trang',
          quantity: 300,
          unit: 'g',
          preparation: 'cooked',
          confidence: 0.94,
        },
      ],
      warnings: [],
    };
    extractRecipeMock.mockResolvedValueOnce(extractedRecipe);

    const recipeText =
      'Com ga xoi mo\0\n- 500g uc ga\n- 300g com trang\nChia 2 phan';
    const res = await http
      .post(`/api/restaurant/menu-items/${menuItemId}/nutrition/analyze-recipe`)
      .set(ownerHeaders())
      .send({ recipeText });

    expect(res.status).toBe(201);
    expect(extractRecipeMock).toHaveBeenCalledWith(
      'Com ga xoi mo\n- 500g uc ga\n- 300g com trang\nChia 2 phan',
    );
    expect(res.body).toMatchObject({
      analysisSessionId: expect.any(String),
      recipeName: 'Com ga xoi mo',
      servings: 2,
      status: 'ANALYZED',
      warnings: [],
      ingredients: [
        {
          rawText: '500g uc ga',
          name: 'uc ga',
          quantity: 500,
          unit: 'g',
          preparation: 'cooked',
          confidence: 0.96,
          requiresConfirmation: false,
          notes: [],
        },
        {
          rawText: '300g com trang',
          name: 'com trang',
          quantity: 300,
          unit: 'g',
          preparation: 'cooked',
          confidence: 0.94,
          requiresConfirmation: false,
          notes: [],
        },
      ],
    });

    const session = await getAnalysisSession(res.body.analysisSessionId);
    expect(session).toMatchObject({
      menuItemId,
      restaurantId: TEST_RESTAURANT_ID,
      inputType: 'text',
      rawRecipeText:
        'Com ga xoi mo\n- 500g uc ga\n- 300g com trang\nChia 2 phan',
      status: 'ANALYZED',
    });
    expect(session!.aiExtractedJson).toMatchObject(extractedRecipe);

    const ingredients = await getAnalysisIngredients(
      res.body.analysisSessionId,
    );
    expect(ingredients).toHaveLength(2);
    expect(
      ingredients
        .map((ingredient) => ({
          extractedName: ingredient.extractedName,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          confidence: ingredient.confidence,
          requiresConfirmation: ingredient.requiresConfirmation,
          notes: ingredient.notes,
        }))
        .sort((a, b) => a.extractedName.localeCompare(b.extractedName)),
    ).toEqual([
      {
        extractedName: 'com trang',
        quantity: 300,
        unit: 'g',
        confidence: 0.94,
        requiresConfirmation: false,
        notes: [],
      },
      {
        extractedName: 'uc ga',
        quantity: 500,
        unit: 'g',
        confidence: 0.96,
        requiresConfirmation: false,
        notes: [],
      },
    ]);
  });

  it('returns the manual-entry fallback and persists a failed session when AI extraction fails', async () => {
    const menuItemId = await createMenuItem('E2E Bun bo fallback');
    extractRecipeMock.mockRejectedValueOnce(new Error('Ollama timeout'));

    const res = await http
      .post(`/api/restaurant/menu-items/${menuItemId}/nutrition/analyze-recipe`)
      .set(ownerHeaders())
      .send({
        recipeText: 'Bun bo\n- thit bo\n- bun\nChia 1 phan',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      analysisSessionId: expect.any(String),
      recipeName: null,
      servings: null,
      ingredients: [],
      status: 'FAILED',
      warnings: [
        'AI analysis service is currently unavailable. Please try again or enter ingredients manually.',
      ],
    });

    const session = await getAnalysisSession(res.body.analysisSessionId);
    expect(session).toMatchObject({
      menuItemId,
      restaurantId: TEST_RESTAURANT_ID,
      inputType: 'text',
      rawRecipeText: 'Bun bo\n- thit bo\n- bun\nChia 1 phan',
      aiExtractedJson: null,
      status: 'FAILED',
    });

    await expect(
      getAnalysisIngredients(res.body.analysisSessionId),
    ).resolves.toEqual([]);
  });

  it('returns saved nutrition and exposes it on menu item detail', async () => {
    const menuItemId = await createMenuItem('E2E Saved nutrition item');
    const extractedRecipe: ExtractedRecipe = {
      recipeName: 'Saved nutrition item',
      servings: 2,
      ingredients: [
        {
          rawText: '500g uc ga',
          name: 'uc ga',
          quantity: 500,
          unit: 'g',
          preparation: 'cooked',
          confidence: 0.96,
        },
      ],
      warnings: [],
    };
    extractRecipeMock.mockResolvedValueOnce(extractedRecipe);

    const analyzeRes = await http
      .post(`/api/restaurant/menu-items/${menuItemId}/nutrition/analyze-recipe`)
      .set(ownerHeaders())
      .send({ recipeText: 'Saved nutrition item\n- 500g uc ga' });

    expect(analyzeRes.status).toBe(201);

    const saveRes = await http
      .put(`/api/restaurant/menu-items/${menuItemId}/nutrition`)
      .set(ownerHeaders())
      .send({
        analysisSessionId: analyzeRes.body.analysisSessionId,
        servings: 2,
        nutrition: {
          calories: 300,
          protein: 32.5,
          carbs: 10,
          fat: 8.2,
          fiber: null,
          sugar: null,
          sodium: null,
        },
        ingredients: [],
        verifiedByRestaurant: true,
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body).toMatchObject({
      servings: 2,
      calories: 300,
      protein: 32.5,
      carbs: 10,
      fat: 8.2,
      fiber: null,
      sugar: null,
      sodium: null,
      source: 'AI_ESTIMATED',
      verifiedByRestaurant: true,
      disclaimer: NUTRITION_DISCLAIMER,
    });

    const detailRes = await http.get(`/api/menu-items/${menuItemId}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.nutrition).toMatchObject(saveRes.body);

    const latestAnalysisRes = await http
      .get(`/api/restaurant/menu-items/${menuItemId}/nutrition/latest`)
      .set(ownerHeaders());

    expect(latestAnalysisRes.status).toBe(200);
    expect(latestAnalysisRes.body).toMatchObject({
      analysisSessionId: analyzeRes.body.analysisSessionId,
      recipeName: 'Saved nutrition item',
      recipeText: 'Saved nutrition item\n- 500g uc ga',
      servings: 2,
      status: 'SAVED',
      warnings: [],
      ingredients: [
        {
          rawText: '500g uc ga',
          name: 'uc ga',
          quantity: 500,
          unit: 'g',
          preparation: 'cooked',
          confidence: 0.96,
          requiresConfirmation: false,
          notes: [],
        },
      ],
    });
  });

  async function createMenuItem(name: string): Promise<string> {
    const res = await http.post('/api/menu-items').set(ownerHeaders()).send({
      restaurantId: TEST_RESTAURANT_ID,
      name,
      price: 45000,
    });

    expect(res.status).toBe(201);
    return res.body.id as string;
  }
});

async function getAnalysisSession(id: string) {
  const db = getTestDb();
  const [session] = await db
    .select()
    .from(nutritionAnalysisSessions)
    .where(eq(nutritionAnalysisSessions.id, id))
    .limit(1);
  return session ?? null;
}

async function getAnalysisIngredients(analysisSessionId: string) {
  const db = getTestDb();
  return db
    .select()
    .from(nutritionAnalysisIngredients)
    .where(
      eq(nutritionAnalysisIngredients.analysisSessionId, analysisSessionId),
    );
}
