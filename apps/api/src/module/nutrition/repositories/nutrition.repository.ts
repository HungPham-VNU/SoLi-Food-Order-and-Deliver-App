import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import {
  menuItemNutrition,
  nutritionAnalysisIngredients,
  nutritionAnalysisSessions,
  nutritionFoods,
  type MenuItemNutrition,
  type NewNutritionAnalysisIngredient,
  type NewNutritionAnalysisSession,
  type NutritionAnalysisIngredient,
  type NutritionAnalysisSession,
  type NutritionFood,
} from '../domain/nutrition.schema';
import type { ExtractedRecipe } from '../types/nutrition.types';

@Injectable()
export class NutritionRepository {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async createSession(
    values: NewNutritionAnalysisSession,
  ): Promise<NutritionAnalysisSession> {
    const [row] = await this.db
      .insert(nutritionAnalysisSessions)
      .values(values)
      .returning();
    return row;
  }

  async findSessionById(
    id: string,
  ): Promise<NutritionAnalysisSession | null> {
    const rows = await this.db
      .select()
      .from(nutritionAnalysisSessions)
      .where(eq(nutritionAnalysisSessions.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findLatestEditableAnalysisByMenuItemId(
    menuItemId: string,
  ): Promise<NutritionAnalysisSession | null> {
    const rows = await this.db
      .select()
      .from(nutritionAnalysisSessions)
      .where(
        and(
          eq(nutritionAnalysisSessions.menuItemId, menuItemId),
          inArray(nutritionAnalysisSessions.status, [
            'SAVED',
            'CALCULATED',
            'ANALYZED',
            'NEEDS_REVIEW',
          ]),
        ),
      )
      .orderBy(desc(nutritionAnalysisSessions.updatedAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async listIngredientsBySessionId(
    analysisSessionId: string,
  ): Promise<NutritionAnalysisIngredient[]> {
    return this.db
      .select()
      .from(nutritionAnalysisIngredients)
      .where(
        eq(nutritionAnalysisIngredients.analysisSessionId, analysisSessionId),
      )
      .orderBy(nutritionAnalysisIngredients.createdAt);
  }

  async updateSessionStatus(
    id: string,
    status: NutritionAnalysisSession['status'],
  ): Promise<void> {
    await this.db
      .update(nutritionAnalysisSessions)
      .set({ status, updatedAt: new Date() })
      .where(eq(nutritionAnalysisSessions.id, id));
  }

  async updateCalculatedSession(
    id: string,
    aiExtractedJson: ExtractedRecipe,
  ): Promise<void> {
    await this.db
      .update(nutritionAnalysisSessions)
      .set({
        aiExtractedJson,
        status: 'CALCULATED',
        updatedAt: new Date(),
      })
      .where(eq(nutritionAnalysisSessions.id, id));
  }

  async insertIngredients(
    rows: NewNutritionAnalysisIngredient[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert(nutritionAnalysisIngredients).values(rows);
  }

  async replaceSessionIngredients(
    analysisSessionId: string,
    rows: NewNutritionAnalysisIngredient[],
  ): Promise<void> {
    await this.db
      .delete(nutritionAnalysisIngredients)
      .where(
        eq(nutritionAnalysisIngredients.analysisSessionId, analysisSessionId),
      );
    await this.insertIngredients(rows);
  }

  async listNutritionFoods(): Promise<NutritionFood[]> {
    return this.db.select().from(nutritionFoods);
  }

  async saveMenuItemNutrition(values: {
    menuItemId: string;
    servings: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number | null;
    sugar?: number | null;
    sodium?: number | null;
    verifiedByRestaurant: boolean;
  }): Promise<MenuItemNutrition> {
    const [row] = await this.db
      .insert(menuItemNutrition)
      .values({
        ...values,
        source: 'AI_ESTIMATED',
      })
      .onConflictDoUpdate({
        target: menuItemNutrition.menuItemId,
        set: {
          servings: values.servings,
          calories: values.calories,
          protein: values.protein,
          carbs: values.carbs,
          fat: values.fat,
          fiber: values.fiber ?? null,
          sugar: values.sugar ?? null,
          sodium: values.sodium ?? null,
          source: 'AI_ESTIMATED',
          verifiedByRestaurant: values.verifiedByRestaurant,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }
}
