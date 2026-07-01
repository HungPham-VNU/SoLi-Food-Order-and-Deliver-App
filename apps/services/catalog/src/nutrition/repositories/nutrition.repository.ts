import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { alias } from 'drizzle-orm/pg-core';
import { CATALOG_DATABASE } from '@/drizzle/database.constants';
import {
  menuItemNutrition,
  nutritionAnalysisIngredients,
  nutritionAnalysisSessions,
  nutritionIngredientAliases,
  nutritionFoodLocalizations,
  nutritionFoods,
  type MenuItemNutrition,
  type NewNutritionAnalysisIngredient,
  type NewNutritionAnalysisSession,
  type NutritionAnalysisIngredient,
  type NutritionAnalysisSession,
  type NutritionFood,
} from '../domain/nutrition.schema';
import type { ExtractedRecipe } from '../types/nutrition.types';
import { AiSearchIndexRepository } from '@/search/indexing/ai-search-index.repository';

const DEFAULT_NUTRITION_FOOD_CANDIDATE_LIMIT = 50;
const MAX_NUTRITION_FOOD_CANDIDATE_LIMIT = 100;

export interface NutritionFoodSearchInput {
  name: string;
  locale?: string | null;
  preferredState?: NutritionFood['state'] | null;
  limit?: number;
}

export type NutritionFoodSearchResult = NutritionFood & {
  localizedName?: string | null;
  localizedAliases?: string[];
  localizedLocale?: string | null;
};

export interface NutritionIngredientAliasLookupInput {
  locale: string;
  normalizedName: string;
}

export interface NutritionIngredientAliasUpsertInput {
  locale: string;
  originalName: string;
  normalizedName: string;
  englishName: string;
  nutritionFoodId?: string | null;
  confidence: number;
  createdBy: string;
}

export interface SaveMenuItemNutritionOptions {
  analysisSessionId?: string;
  ingredients?: NewNutritionAnalysisIngredient[];
}

@Injectable()
export class NutritionRepository {
  constructor(
    @Inject(CATALOG_DATABASE)
    private readonly db: NodePgDatabase,
    private readonly searchIndex: AiSearchIndexRepository,
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

  async findSessionById(id: string): Promise<NutritionAnalysisSession | null> {
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

  async findNutritionFoodById(
    id: string,
    locale?: string | null,
  ): Promise<NutritionFoodSearchResult | null> {
    const normalizedLocale = this.normalizeNutritionLocale(locale);
    const localizedFood = alias(
      nutritionFoodLocalizations,
      'selected_nutrition_food_localization',
    );

    const rows = await this.db
      .select({
        food: nutritionFoods,
        localizedName: localizedFood.name,
        localizedAliases: localizedFood.aliases,
        localizedLocale: localizedFood.locale,
      })
      .from(nutritionFoods)
      .leftJoin(
        localizedFood,
        and(
          eq(localizedFood.nutritionFoodId, nutritionFoods.id),
          eq(localizedFood.locale, normalizedLocale),
        ),
      )
      .where(eq(nutritionFoods.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      ...row.food,
      localizedName: row.localizedName,
      localizedAliases: row.localizedAliases ?? [],
      localizedLocale: row.localizedLocale,
    };
  }

  async findNutritionIngredientAlias(
    input: NutritionIngredientAliasLookupInput,
  ) {
    const rows = await this.db
      .select()
      .from(nutritionIngredientAliases)
      .where(
        and(
          eq(nutritionIngredientAliases.locale, input.locale),
          eq(nutritionIngredientAliases.normalizedName, input.normalizedName),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async upsertNutritionIngredientAlias(
    input: NutritionIngredientAliasUpsertInput,
  ): Promise<void> {
    await this.db
      .insert(nutritionIngredientAliases)
      .values({
        locale: input.locale,
        originalName: input.originalName,
        normalizedName: input.normalizedName,
        englishName: input.englishName,
        nutritionFoodId: input.nutritionFoodId ?? null,
        confidence: Math.min(1, Math.max(0, input.confidence)),
        createdBy: input.createdBy,
      })
      .onConflictDoUpdate({
        target: [
          nutritionIngredientAliases.locale,
          nutritionIngredientAliases.normalizedName,
        ],
        set: {
          originalName: sql`CASE WHEN excluded.confidence > ${nutritionIngredientAliases.confidence} THEN excluded.original_name ELSE ${nutritionIngredientAliases.originalName} END`,
          englishName: sql`CASE WHEN excluded.confidence > ${nutritionIngredientAliases.confidence} THEN excluded.english_name ELSE ${nutritionIngredientAliases.englishName} END`,
          nutritionFoodId: sql`CASE WHEN excluded.confidence > ${nutritionIngredientAliases.confidence} THEN COALESCE(excluded.nutrition_food_id, ${nutritionIngredientAliases.nutritionFoodId}) ELSE ${nutritionIngredientAliases.nutritionFoodId} END`,
          confidence: sql`GREATEST(excluded.confidence, ${nutritionIngredientAliases.confidence})`,
          createdBy: sql`CASE WHEN excluded.confidence > ${nutritionIngredientAliases.confidence} THEN excluded.created_by ELSE ${nutritionIngredientAliases.createdBy} END`,
          updatedAt: sql`CASE WHEN excluded.confidence > ${nutritionIngredientAliases.confidence} THEN ${new Date()} ELSE ${nutritionIngredientAliases.updatedAt} END`,
        },
      });
  }

  async searchNutritionFoodsForIngredient(
    input: NutritionFoodSearchInput,
  ): Promise<NutritionFoodSearchResult[]> {
    const query = this.normalizeNutritionFoodSearch(input.name);
    if (query.length === 0) return [];

    const locale = this.normalizeNutritionLocale(input.locale);
    const limit = Math.min(
      Math.max(input.limit ?? DEFAULT_NUTRITION_FOOD_CANDIDATE_LIMIT, 1),
      MAX_NUTRITION_FOOD_CANDIDATE_LIMIT,
    );
    const queryPattern = `%${query}%`;
    const preferredState = input.preferredState ?? null;
    const localizedFood = alias(
      nutritionFoodLocalizations,
      'localized_nutrition_foods',
    );

    const searchableText = sql<string>`(
      COALESCE(${localizedFood.name}, '')
      || ' '
      || COALESCE(array_to_string(${localizedFood.aliases}, ' '), '')
      || ' '
      || ${nutritionFoods.nameVi}
      || ' '
      || ${nutritionFoods.nameEn}
      || ' '
      || COALESCE(${nutritionFoods.category}, '')
    )`;
    const fullText = sql`to_tsvector('simple', ${searchableText})`;
    const fullTextQuery = sql`plainto_tsquery('simple', ${query})`;

    const indexedLocalizedAliasExactMatch = sql`COALESCE(${localizedFood.aliases}, '{}'::text[]) @> ARRAY[lower(${query})]::text[]`;
    const exactLocalizedAliasMatch = sql`EXISTS (
      SELECT 1
      FROM unnest(COALESCE(${localizedFood.aliases}, '{}'::text[])) AS aliases(alias_value)
      WHERE lower(unaccent(alias_value)) = lower(unaccent(${query}))
    )`;
    const partialLocalizedAliasMatch = sql`EXISTS (
      SELECT 1
      FROM unnest(COALESCE(${localizedFood.aliases}, '{}'::text[])) AS aliases(alias_value)
      WHERE unaccent(alias_value) ILIKE unaccent(${queryPattern})
    )`;
    const localizedAliasSimilarity = sql`COALESCE((
      SELECT MAX(similarity(lower(alias_value), lower(${query})))
      FROM unnest(COALESCE(${localizedFood.aliases}, '{}'::text[])) AS aliases(alias_value)
    ), 0)`;
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
      CASE WHEN lower(unaccent(${localizedFood.name})) = lower(unaccent(${query}))
        THEN 110 ELSE 0 END
      + CASE WHEN (${indexedLocalizedAliasExactMatch} OR ${exactLocalizedAliasMatch})
        THEN 108 ELSE 0 END
      + CASE WHEN unaccent(${localizedFood.name}) ILIKE unaccent(${queryPattern})
        THEN 72 ELSE 0 END
      + CASE WHEN ${partialLocalizedAliasMatch}
        THEN 70 ELSE 0 END
      + CASE WHEN lower(unaccent(${nutritionFoods.nameVi})) = lower(unaccent(${query}))
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
          similarity(lower(COALESCE(${localizedFood.name}, '')), lower(${query})),
          similarity(lower(${nutritionFoods.nameVi}), lower(${query})),
          similarity(lower(${nutritionFoods.nameEn}), lower(${query})),
          ${localizedAliasSimilarity},
          ${aliasSimilarity}
        ) * 30
      + ${stateScore}
    )`;

    const rows = await this.db
      .select({
        food: nutritionFoods,
        localizedName: localizedFood.name,
        localizedAliases: localizedFood.aliases,
        localizedLocale: localizedFood.locale,
      })
      .from(nutritionFoods)
      .leftJoin(
        localizedFood,
        and(
          eq(localizedFood.nutritionFoodId, nutritionFoods.id),
          eq(localizedFood.locale, locale),
        ),
      )
      .where(
        sql`(
        lower(${localizedFood.name}) = lower(${query})
        OR ${indexedLocalizedAliasExactMatch}
        OR ${exactLocalizedAliasMatch}
        OR lower(${localizedFood.name}) ILIKE lower(${queryPattern})
        OR ${partialLocalizedAliasMatch}
        OR lower(${localizedFood.name}) % lower(${query})
        OR lower(unaccent(${localizedFood.name})) = lower(unaccent(${query}))
        OR unaccent(${localizedFood.name}) ILIKE unaccent(${queryPattern})
        OR lower(${nutritionFoods.nameVi}) = lower(${query})
        OR lower(${nutritionFoods.nameEn}) = lower(${query})
        OR ${indexedAliasExactMatch}
        OR ${exactAliasMatch}
        OR lower(${nutritionFoods.nameVi}) ILIKE lower(${queryPattern})
        OR lower(${nutritionFoods.nameEn}) ILIKE lower(${queryPattern})
        OR ${partialAliasMatch}
        OR ${fullText} @@ ${fullTextQuery}
        OR lower(${nutritionFoods.nameVi}) % lower(${query})
        OR lower(${nutritionFoods.nameEn}) % lower(${query})
      )`,
      )
      .orderBy(
        sql`${score} DESC`,
        sql`COALESCE(${localizedFood.name}, ${nutritionFoods.nameVi})`,
      )
      .limit(limit);

    return rows.map((row) => ({
      ...row.food,
      localizedName: row.localizedName,
      localizedAliases: row.localizedAliases ?? [],
      localizedLocale: row.localizedLocale,
    }));
  }

  async saveMenuItemNutrition(
    values: {
      menuItemId: string;
      servings: number;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number | null;
      sugar?: number | null;
      sodium?: number | null;
      source: MenuItemNutrition['source'];
      verifiedByRestaurant: boolean;
    },
    options: SaveMenuItemNutritionOptions = {},
  ): Promise<MenuItemNutrition> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(menuItemNutrition)
        .values(values)
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
            source: values.source,
            verifiedByRestaurant: values.verifiedByRestaurant,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (options.analysisSessionId) {
        if (options.ingredients) {
          await tx
            .delete(nutritionAnalysisIngredients)
            .where(
              eq(
                nutritionAnalysisIngredients.analysisSessionId,
                options.analysisSessionId,
              ),
            );

          if (options.ingredients.length > 0) {
            await tx
              .insert(nutritionAnalysisIngredients)
              .values(options.ingredients);
          }
        }

        await tx
          .update(nutritionAnalysisSessions)
          .set({ status: 'SAVED', updatedAt: new Date() })
          .where(eq(nutritionAnalysisSessions.id, options.analysisSessionId));
      }

      await this.searchIndex.refreshMenuItemSearchMetadata(
        values.menuItemId,
        tx,
      );
      return row;
    });
  }

  private normalizeNutritionFoodSearch(value: string): string {
    return value.trim().replace(/\0/g, '').replace(/\s+/g, ' ').slice(0, 120);
  }

  private normalizeNutritionLocale(value: string | null | undefined): string {
    const locale = (value ?? 'vi')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 16);

    return locale || 'vi';
  }
}
