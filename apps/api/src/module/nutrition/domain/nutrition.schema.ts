import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { restaurants } from '@/module/restaurant-catalog/restaurant/restaurant.schema';
import { menuItems } from '@/module/restaurant-catalog/menu/menu.schema';

export const nutritionFoodStateEnum = pgEnum('nutrition_food_state', [
  'raw',
  'cooked',
  'fried',
  'boiled',
  'grilled',
  'unknown',
]);

export const nutritionInputTypeEnum = pgEnum('nutrition_input_type', [
  'text',
  'image',
]);

export const nutritionAnalysisStatusEnum = pgEnum('nutrition_analysis_status', [
  'ANALYZED',
  'NEEDS_REVIEW',
  'CALCULATED',
  'SAVED',
  'FAILED',
]);

export const menuItemNutritionSourceEnum = pgEnum(
  'menu_item_nutrition_source',
  ['AI_ESTIMATED', 'MANUALLY_ENTERED', 'VERIFIED_BY_RESTAURANT'],
);

export const nutritionFoods = pgTable(
  'nutrition_foods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    nameVi: text('name_vi').notNull(),
    nameEn: text('name_en').notNull(),
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    category: text('category'),
    state: nutritionFoodStateEnum('state').notNull().default('unknown'),
    calories100g: real('calories_100g').notNull(),
    protein100g: real('protein_100g').notNull(),
    carbs100g: real('carbs_100g').notNull(),
    fat100g: real('fat_100g').notNull(),
    fiber100g: real('fiber_100g'),
    sugar100g: real('sugar_100g'),
    sodium100g: real('sodium_100g'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('nutrition_foods_name_state_uidx').on(
      table.nameVi,
      table.state,
    ),
    index('nutrition_foods_aliases_gin_idx').using('gin', table.aliases),
    index('nutrition_foods_name_vi_idx').on(table.nameVi),
    index('nutrition_foods_state_idx').on(table.state),
  ],
);

export const nutritionAnalysisSessions = pgTable(
  'nutrition_analysis_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    inputType: nutritionInputTypeEnum('input_type').notNull().default('text'),
    rawRecipeText: text('raw_recipe_text').notNull(),
    aiExtractedJson: jsonb('ai_extracted_json'),
    status: nutritionAnalysisStatusEnum('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('nutrition_sessions_menu_item_idx').on(table.menuItemId),
    index('nutrition_sessions_restaurant_idx').on(table.restaurantId),
  ],
);

export const nutritionAnalysisIngredients = pgTable(
  'nutrition_analysis_ingredients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    analysisSessionId: uuid('analysis_session_id')
      .notNull()
      .references(() => nutritionAnalysisSessions.id, {
        onDelete: 'cascade',
      }),
    rawText: text('raw_text'),
    extractedName: text('extracted_name').notNull(),
    correctedName: text('corrected_name'),
    quantity: real('quantity'),
    unit: text('unit').notNull(),
    quantityGram: real('quantity_gram'),
    matchedNutritionFoodId: uuid('matched_nutrition_food_id').references(
      () => nutritionFoods.id,
      { onDelete: 'set null' },
    ),
    confidence: real('confidence'),
    requiresConfirmation: boolean('requires_confirmation')
      .notNull()
      .default(false),
    notes: text('notes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('nutrition_analysis_ingredients_session_idx').on(
      table.analysisSessionId,
    ),
    index('nutrition_analysis_ingredients_food_idx').on(
      table.matchedNutritionFoodId,
    ),
  ],
);

export const menuItemNutrition = pgTable(
  'menu_item_nutrition',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    servings: integer('servings').notNull(),
    calories: real('calories').notNull(),
    protein: real('protein').notNull(),
    carbs: real('carbs').notNull(),
    fat: real('fat').notNull(),
    fiber: real('fiber'),
    sugar: real('sugar'),
    sodium: real('sodium'),
    source: menuItemNutritionSourceEnum('source')
      .notNull()
      .default('AI_ESTIMATED'),
    verifiedByRestaurant: boolean('verified_by_restaurant')
      .notNull()
      .default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('menu_item_nutrition_menu_item_uidx').on(table.menuItemId),
  ],
);

export type NutritionFood = typeof nutritionFoods.$inferSelect;
export type NewNutritionAnalysisSession =
  typeof nutritionAnalysisSessions.$inferInsert;
export type NutritionAnalysisSession =
  typeof nutritionAnalysisSessions.$inferSelect;
export type NewNutritionAnalysisIngredient =
  typeof nutritionAnalysisIngredients.$inferInsert;
export type MenuItemNutrition = typeof menuItemNutrition.$inferSelect;
