import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
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

const DEFAULT_NUTRITION_FOOD_CANDIDATE_LIMIT = 50;
const MAX_NUTRITION_FOOD_CANDIDATE_LIMIT = 100;

export interface NutritionFoodSearchInput {
  name: string;
  preferredState?: NutritionFood['state'] | null;
  limit?: number;
}

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

  async searchNutritionFoodsForIngredient(
    input: NutritionFoodSearchInput,
  ): Promise<NutritionFood[]> {
    const query = this.normalizeNutritionFoodSearch(input.name);
    if (query.length === 0) return [];

    const limit = Math.min(
      Math.max(input.limit ?? DEFAULT_NUTRITION_FOOD_CANDIDATE_LIMIT, 1),
      MAX_NUTRITION_FOOD_CANDIDATE_LIMIT,
    );
    const queryPattern = `%${query}%`;
    const preferredState = input.preferredState ?? null;

    const searchableText = sql<string>`(
      ${nutritionFoods.nameVi}
      || ' '
      || ${nutritionFoods.nameEn}
      || ' '
      || COALESCE(${nutritionFoods.category}, '')
    )`;
    const fullText = sql`to_tsvector('simple', ${searchableText})`;
    const fullTextQuery = sql`plainto_tsquery('simple', ${query})`;

    const indexedAliasExactMatch = sql`${nutritionFoods.aliases} @> ARRAY[lower(${query})]::text[]`;
    const exactAliasMatch = sql`EXISTS (
      SELECT 1
      FROM unnest(${nutritionFoods.aliases}) AS aliases(alias_value)
      WHERE lower(unaccent(alias_value)) = lower(unaccent(${query}))
    )`;
    const partialAliasMatch = sql`EXISTS (
      SELECT 1
      FROM unnest(${nutritionFoods.aliases}) AS aliases(alias_value)
      WHERE unaccent(alias_value) ILIKE unaccent(${queryPattern})
    )`;
    const aliasSimilarity = sql`COALESCE((
      SELECT MAX(similarity(lower(alias_value), lower(${query})))
      FROM unnest(${nutritionFoods.aliases}) AS aliases(alias_value)
    ), 0)`;
    const stateScore = preferredState
      ? sql`CASE
          WHEN ${nutritionFoods.state} = ${preferredState} THEN 4
          WHEN ${nutritionFoods.state} = 'unknown' THEN 1
          ELSE 0
        END`
      : sql`0`;

    const score = sql<number>`(
      CASE WHEN lower(unaccent(${nutritionFoods.nameVi})) = lower(unaccent(${query}))
        THEN 100 ELSE 0 END
      + CASE WHEN lower(unaccent(${nutritionFoods.nameEn})) = lower(unaccent(${query}))
        THEN 96 ELSE 0 END
      + CASE WHEN (${indexedAliasExactMatch} OR ${exactAliasMatch})
        THEN 98 ELSE 0 END
      + CASE WHEN unaccent(${nutritionFoods.nameVi}) ILIKE unaccent(${queryPattern})
        THEN 65 ELSE 0 END
      + CASE WHEN unaccent(${nutritionFoods.nameEn}) ILIKE unaccent(${queryPattern})
        THEN 62 ELSE 0 END
      + CASE WHEN ${partialAliasMatch}
        THEN 64 ELSE 0 END
      + CASE WHEN ${fullText} @@ ${fullTextQuery}
        THEN 45 ELSE 0 END
      + GREATEST(
          similarity(lower(${nutritionFoods.nameVi}), lower(${query})),
          similarity(lower(${nutritionFoods.nameEn}), lower(${query})),
          ${aliasSimilarity}
        ) * 30
      + ${stateScore}
    )`;

    return this.db
      .select()
      .from(nutritionFoods)
      .where(sql`(
        lower(${nutritionFoods.nameVi}) = lower(${query})
        OR lower(${nutritionFoods.nameEn}) = lower(${query})
        OR ${indexedAliasExactMatch}
        OR lower(${nutritionFoods.nameVi}) ILIKE lower(${queryPattern})
        OR lower(${nutritionFoods.nameEn}) ILIKE lower(${queryPattern})
        OR ${fullText} @@ ${fullTextQuery}
        OR lower(${nutritionFoods.nameVi}) % lower(${query})
        OR lower(${nutritionFoods.nameEn}) % lower(${query})
      )`)
      .orderBy(sql`${score} DESC`, nutritionFoods.nameVi)
      .limit(limit);
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

  private normalizeNutritionFoodSearch(value: string): string {
    return value.trim().replace(/\0/g, '').replace(/\s+/g, ' ').slice(0, 120);
  }
}
