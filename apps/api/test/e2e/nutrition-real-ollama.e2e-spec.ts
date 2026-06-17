import { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  nutritionAnalysisIngredients,
  nutritionAnalysisSessions,
} from '../../src/module/nutrition/domain/nutrition.schema';
import {
  NUTRITION_ANALYSIS_STATUSES,
  NUTRITION_UNITS,
  PREPARATION_STATES,
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

const REAL_OLLAMA_E2E_SPEC_NAME = 'nutrition-real-ollama.e2e-spec.ts';

const realOllamaEnvEnabled = ['1', 'true', 'yes'].includes(
  (process.env.RUN_REAL_OLLAMA_E2E ?? '').toLowerCase(),
);
const directRealOllamaRun = process.argv.some((arg) =>
  arg.includes(REAL_OLLAMA_E2E_SPEC_NAME),
);
const realOllamaEnabled = realOllamaEnvEnabled || directRealOllamaRun;
const describeRealOllama = realOllamaEnabled ? describe : describe.skip;

jest.setTimeout(90000);

describeRealOllama('AI Nutrition Analyzer with real Ollama (E2E)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    assertRealOllamaE2eConfig();

    app = await createTestApp();
    http = request(app.getHttpServer());

    await resetDb();

    const testAuth = new TestAuthManager();
    await testAuth.initialize(http);
    setAuthManager(testAuth);

    await seedBaseRestaurant(testAuth.ownerUserId);
  });

  afterAll(async () => {
    if (app) {
      await teardownTestApp(app);
    }
  });

  it('calls the configured real Ollama service through the analyze endpoint', async () => {
    const menuItemId = await createMenuItem('Real Ollama Com ga');
    const recipeText = [
      'Com ga xoi mo cho 2 phan',
      '- 500 g uc ga da nau chin',
      '- 300 g com trang da nau chin',
      '- 20 g dau an',
    ].join('\n');

    const res = await http
      .post(`/api/restaurant/menu-items/${menuItemId}/nutrition/analyze-recipe`)
      .set(ownerHeaders())
      .send({ recipeText });

    expect(res.status).toBe(201);
    expect(res.body.analysisSessionId).toEqual(expect.any(String));
    expect(res.body.status).not.toBe('FAILED');
    expect(NUTRITION_ANALYSIS_STATUSES).toContain(res.body.status);
    expect(res.body.ingredients).toEqual(expect.any(Array));
    expect(res.body.ingredients.length).toBeGreaterThanOrEqual(2);
    expect(res.body.warnings).toEqual(expect.any(Array));

    for (const ingredient of res.body.ingredients) {
      expect(ingredient).toMatchObject({
        rawText: expect.any(String),
        name: expect.any(String),
        unit: expect.any(String),
        preparation: expect.any(String),
        confidence: expect.any(Number),
        requiresConfirmation: expect.any(Boolean),
        notes: expect.any(Array),
      });
      expect(
        ingredient.quantity === null || typeof ingredient.quantity === 'number',
      ).toBe(true);
      expect(NUTRITION_UNITS).toContain(ingredient.unit);
      expect(PREPARATION_STATES).toContain(ingredient.preparation);
      expect(ingredient.confidence).toBeGreaterThanOrEqual(0);
      expect(ingredient.confidence).toBeLessThanOrEqual(1);
    }

    const session = await getAnalysisSession(res.body.analysisSessionId);
    expect(session).toMatchObject({
      menuItemId,
      restaurantId: TEST_RESTAURANT_ID,
      inputType: 'text',
      rawRecipeText: recipeText,
      status: res.body.status,
    });
    expect(session.aiExtractedJson).not.toBeNull();

    const persistedIngredients = await getAnalysisIngredients(
      res.body.analysisSessionId,
    );
    expect(persistedIngredients).toHaveLength(res.body.ingredients.length);
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

function assertRealOllamaE2eConfig() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'Real Ollama E2E requires TEST_DATABASE_URL to point at a dedicated E2E database.',
    );
  }

  if (!process.env.OLLAMA_API_KEY) {
    throw new Error('Real Ollama Cloud E2E requires OLLAMA_API_KEY.');
  }
}

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
