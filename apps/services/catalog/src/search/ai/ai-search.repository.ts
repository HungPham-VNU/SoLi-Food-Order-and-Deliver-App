import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, or, SQL, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CATALOG_DATABASE } from '@/drizzle/database.constants';
import { menuItemNutrition } from '@/nutrition/domain/nutrition.schema';
import {
  menuCategories,
  menuItems,
  menuItemStatusEnum,
} from '../../menu/menu.schema';
import { restaurants } from '../../restaurant/restaurant.schema';
import {
  aiSearchItemRankingStats,
  aiSearchRestaurantRankingStats,
} from './ai-search-ranking-stats.schema';
import type {
  AiSearchItemCandidate,
  AiSearchIntent,
  AiSearchPopularitySignals,
  AiSearchRepositoryFilters,
  AiSearchRestaurantCandidate,
} from './ai-search.types';

const EARTH_RADIUS_KM = 6371;
const TRIGRAM_MIN_SIMILARITY = 0.08;

@Injectable()
export class AiSearchRepository {
  constructor(@Inject(CATALOG_DATABASE) private readonly db: NodePgDatabase) {}

  async findItems(
    filters: AiSearchRepositoryFilters,
  ): Promise<AiSearchItemCandidate[]> {
    const conditions: SQL<unknown>[] = [
      eq(
        menuItems.status,
        'available' as (typeof menuItemStatusEnum.enumValues)[number],
      ),
      sql`${restaurants.isApproved} = true`,
      sql`${restaurants.isOpen} = true`,
    ];

    this.applyItemHardFilters(conditions, filters);
    this.applyGeoConditions(conditions, filters);

    const branchCondition = this.buildItemBranchCondition(filters);
    if (branchCondition) conditions.push(branchCondition);

    const whereClause = and(...conditions);
    const distanceExpr = this.buildDistanceExpr(filters);
    const branchScoreExpr = this.buildItemBranchScoreExpr(
      filters,
      distanceExpr,
    );

    const rows = await this.db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        description: menuItems.description,
        price: menuItems.price,
        itemKind: menuItems.itemKind,
        imageUrl: menuItems.imageUrl,
        tags: menuItems.tags,
        createdAt: menuItems.createdAt,
        updatedAt: menuItems.updatedAt,
        categoryName: menuCategories.name,
        calories: menuItemNutrition.calories,
        protein: menuItemNutrition.protein,
        carbs: menuItemNutrition.carbs,
        fat: menuItemNutrition.fat,
        verifiedByRestaurant: menuItemNutrition.verifiedByRestaurant,
        restaurantId: restaurants.id,
        restaurantName: restaurants.name,
        restaurantAddress: restaurants.address,
        cuisineType: restaurants.cuisineType,
        logoUrl: restaurants.logoUrl,
        coverImageUrl: restaurants.coverImageUrl,
        averageRating: restaurants.averageRating,
        ratingSum: restaurants.ratingSum,
        reviewCount: restaurants.reviewCount,
        restaurantLatitude: restaurants.latitude,
        restaurantLongitude: restaurants.longitude,
        distanceKm: distanceExpr,
        branchScore: branchScoreExpr,
        popularityDeliveredOrderCount30d:
          aiSearchItemRankingStats.deliveredOrderCount30d,
        popularityDeliveredOrderCount90d:
          aiSearchItemRankingStats.deliveredOrderCount90d,
        popularityOrderedQuantity30d:
          aiSearchItemRankingStats.orderedQuantity30d,
        popularityOrderedQuantity90d:
          aiSearchItemRankingStats.orderedQuantity90d,
        popularityLastOrderedAt: aiSearchItemRankingStats.lastOrderedAt,
        popularityUpdatedAt: aiSearchItemRankingStats.updatedAt,
      })
      .from(menuItems)
      .innerJoin(restaurants, eq(menuItems.restaurantId, restaurants.id))
      .leftJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
      .leftJoin(
        menuItemNutrition,
        eq(menuItemNutrition.menuItemId, menuItems.id),
      )
      .leftJoin(
        aiSearchItemRankingStats,
        eq(aiSearchItemRankingStats.menuItemId, menuItems.id),
      )
      .where(whereClause)
      .orderBy(...this.buildItemOrderBy(filters, branchScoreExpr, distanceExpr))
      .limit(filters.limit);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      itemKind: row.itemKind,
      imageUrl: row.imageUrl,
      tags: row.tags,
      categoryName: row.categoryName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      score: 0,
      nutrition:
        row.protein === null &&
        row.calories === null &&
        row.carbs === null &&
        row.fat === null
          ? null
          : {
              calories: numberOrNull(row.calories),
              protein: numberOrNull(row.protein),
              carbs: numberOrNull(row.carbs),
              fat: numberOrNull(row.fat),
              verifiedByRestaurant: row.verifiedByRestaurant ?? null,
            },
      retrievalBranches: [filters.branch],
      branchScores: {
        [filters.branch]: clamp01(numberOrZero(row.branchScore)),
      },
      popularity: buildPopularitySignals({
        deliveredOrderCount30d: row.popularityDeliveredOrderCount30d,
        deliveredOrderCount90d: row.popularityDeliveredOrderCount90d,
        orderedQuantity30d: row.popularityOrderedQuantity30d,
        orderedQuantity90d: row.popularityOrderedQuantity90d,
        lastOrderedAt: row.popularityLastOrderedAt,
        updatedAt: row.popularityUpdatedAt,
      }),
      restaurant: {
        id: row.restaurantId,
        name: row.restaurantName,
        address: row.restaurantAddress,
        cuisineType: row.cuisineType,
        logoUrl: row.logoUrl,
        coverImageUrl: row.coverImageUrl,
        averageRating: numberOrZero(row.averageRating),
        ratingSum: numberOrZero(row.ratingSum),
        reviewCount: numberOrZero(row.reviewCount),
        latitude: row.restaurantLatitude,
        longitude: row.restaurantLongitude,
        distanceKm: numberOrNull(row.distanceKm),
      },
    }));
  }

  async findRestaurants(
    filters: AiSearchRepositoryFilters,
  ): Promise<AiSearchRestaurantCandidate[]> {
    const conditions: SQL<unknown>[] = [
      sql`${restaurants.isApproved} = true`,
      sql`${restaurants.isOpen} = true`,
    ];

    const { intent } = filters;

    if (intent.rating.minAverageRating !== undefined) {
      conditions.push(
        sql`${restaurants.averageRating} >= ${intent.rating.minAverageRating}`,
      );
    }
    if (intent.rating.minReviewCount !== undefined) {
      conditions.push(
        sql`${restaurants.reviewCount} >= ${intent.rating.minReviewCount}`,
      );
    }

    this.applyGeoConditions(conditions, filters);
    this.applyRestaurantItemEligibilityConditions(conditions, filters);

    const branchCondition = this.buildRestaurantBranchCondition(filters);
    if (branchCondition) conditions.push(branchCondition);
    const distanceExpr = this.buildDistanceExpr(filters);
    const branchScoreExpr = this.buildRestaurantBranchScoreExpr(
      filters,
      distanceExpr,
    );

    const rows = await this.db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        description: restaurants.description,
        address: restaurants.address,
        phone: restaurants.phone,
        isOpen: restaurants.isOpen,
        latitude: restaurants.latitude,
        longitude: restaurants.longitude,
        cuisineType: restaurants.cuisineType,
        logoUrl: restaurants.logoUrl,
        coverImageUrl: restaurants.coverImageUrl,
        averageRating: restaurants.averageRating,
        ratingSum: restaurants.ratingSum,
        reviewCount: restaurants.reviewCount,
        createdAt: restaurants.createdAt,
        updatedAt: restaurants.updatedAt,
        distanceKm: distanceExpr,
        branchScore: branchScoreExpr,
        popularityDeliveredOrderCount30d:
          aiSearchRestaurantRankingStats.deliveredOrderCount30d,
        popularityDeliveredOrderCount90d:
          aiSearchRestaurantRankingStats.deliveredOrderCount90d,
        popularityOrderedQuantity30d:
          aiSearchRestaurantRankingStats.orderedQuantity30d,
        popularityOrderedQuantity90d:
          aiSearchRestaurantRankingStats.orderedQuantity90d,
        popularityLastOrderedAt: aiSearchRestaurantRankingStats.lastOrderedAt,
        popularityUpdatedAt: aiSearchRestaurantRankingStats.updatedAt,
      })
      .from(restaurants)
      .leftJoin(
        aiSearchRestaurantRankingStats,
        eq(aiSearchRestaurantRankingStats.restaurantId, restaurants.id),
      )
      .where(and(...conditions))
      .orderBy(
        ...this.buildRestaurantOrderBy(filters, branchScoreExpr, distanceExpr),
      )
      .limit(filters.limit);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      address: row.address,
      phone: row.phone,
      isOpen: row.isOpen,
      latitude: row.latitude,
      longitude: row.longitude,
      cuisineType: row.cuisineType,
      logoUrl: row.logoUrl,
      coverImageUrl: row.coverImageUrl,
      averageRating: numberOrZero(row.averageRating),
      ratingSum: numberOrZero(row.ratingSum),
      reviewCount: numberOrZero(row.reviewCount),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      distanceKm: numberOrNull(row.distanceKm),
      score: 0,
      retrievalBranches: [filters.branch],
      branchScores: {
        [filters.branch]: clamp01(numberOrZero(row.branchScore)),
      },
      popularity: buildPopularitySignals({
        deliveredOrderCount30d: row.popularityDeliveredOrderCount30d,
        deliveredOrderCount90d: row.popularityDeliveredOrderCount90d,
        orderedQuantity30d: row.popularityOrderedQuantity30d,
        orderedQuantity90d: row.popularityOrderedQuantity90d,
        lastOrderedAt: row.popularityLastOrderedAt,
        updatedAt: row.popularityUpdatedAt,
      }),
    }));
  }

  private applyItemHardFilters(
    conditions: SQL<unknown>[],
    filters: AiSearchRepositoryFilters,
  ): void {
    const { intent } = filters;

    if (intent.itemKinds.length > 0) {
      conditions.push(inArray(menuItems.itemKind, intent.itemKinds));
    }

    if (intent.dietaryTags.length > 0) {
      intent.dietaryTags.forEach((tag) => {
        conditions.push(
          sql`${tag} = ANY(COALESCE(${menuItems.tags}, ARRAY[]::text[]))`,
        );
      });
    }

    if (intent.excludedTerms.length > 0) {
      intent.excludedTerms.forEach((term) => {
        const pattern = `%${term}%`;
        conditions.push(
          sql`NOT (${term} = ANY(COALESCE(${menuItems.tags}, ARRAY[]::text[])))`,
        );
        conditions.push(
          sql`unaccent(COALESCE(${menuItems.name}, '')) NOT ILIKE unaccent(${pattern})`,
        );
        conditions.push(
          sql`unaccent(COALESCE(${menuItems.description}, '')) NOT ILIKE unaccent(${pattern})`,
        );
      });
    }

    if (hasNutritionIntent(intent)) {
      conditions.push(eq(menuItemNutrition.verifiedByRestaurant, true));
    }

    if (intent.price.maxPriceVnd !== undefined) {
      conditions.push(sql`${menuItems.price} <= ${intent.price.maxPriceVnd}`);
    }
    if (intent.price.minPriceVnd !== undefined) {
      conditions.push(sql`${menuItems.price} >= ${intent.price.minPriceVnd}`);
    }
    if (intent.rating.minAverageRating !== undefined) {
      conditions.push(
        sql`${restaurants.averageRating} >= ${intent.rating.minAverageRating}`,
      );
    }
    if (intent.rating.minReviewCount !== undefined) {
      conditions.push(
        sql`${restaurants.reviewCount} >= ${intent.rating.minReviewCount}`,
      );
    }
    if (intent.nutrition.proteinMinG !== undefined) {
      conditions.push(
        sql`${menuItemNutrition.protein} >= ${intent.nutrition.proteinMinG}`,
      );
    }
    if (intent.nutrition.caloriesMax !== undefined) {
      conditions.push(
        sql`${menuItemNutrition.calories} <= ${intent.nutrition.caloriesMax}`,
      );
    }
    if (intent.nutrition.fatMaxG !== undefined) {
      conditions.push(
        sql`${menuItemNutrition.fat} <= ${intent.nutrition.fatMaxG}`,
      );
    }
    if (intent.nutrition.carbsMaxG !== undefined) {
      conditions.push(
        sql`${menuItemNutrition.carbs} <= ${intent.nutrition.carbsMaxG}`,
      );
    }
  }

  private applyRestaurantItemEligibilityConditions(
    conditions: SQL<unknown>[],
    filters: AiSearchRepositoryFilters,
  ): void {
    const { intent } = filters;
    const hasItemEligibility =
      intent.itemKinds.length > 0 ||
      intent.dietaryTags.length > 0 ||
      intent.excludedTerms.length > 0 ||
      intent.price.maxPriceVnd !== undefined ||
      intent.price.minPriceVnd !== undefined ||
      hasNutritionIntent(intent);
    if (!hasItemEligibility) return;

    const itemConditions: SQL<unknown>[] = [
      sql`eligible_item.restaurant_id = ${restaurants.id}`,
      sql`eligible_item.status = 'available'`,
    ];

    if (intent.itemKinds.length > 0) {
      itemConditions.push(
        sql`eligible_item.item_kind IN (${sql.join(
          intent.itemKinds.map((kind) => sql`${kind}`),
          sql`, `,
        )})`,
      );
    }
    if (intent.dietaryTags.length > 0) {
      for (const tag of intent.dietaryTags) {
        itemConditions.push(
          sql`${tag} = ANY(COALESCE(eligible_item.tags, ARRAY[]::text[]))`,
        );
      }
    }
    if (intent.excludedTerms.length > 0) {
      for (const term of intent.excludedTerms) {
        const pattern = `%${term}%`;
        itemConditions.push(
          sql`NOT (${term} = ANY(COALESCE(eligible_item.tags, ARRAY[]::text[])))`,
        );
        itemConditions.push(
          sql`unaccent(COALESCE(eligible_item.name, '')) NOT ILIKE unaccent(${pattern})`,
        );
        itemConditions.push(
          sql`unaccent(COALESCE(eligible_item.description, '')) NOT ILIKE unaccent(${pattern})`,
        );
      }
    }
    if (intent.price.maxPriceVnd !== undefined) {
      itemConditions.push(
        sql`eligible_item.price <= ${intent.price.maxPriceVnd}`,
      );
    }
    if (intent.price.minPriceVnd !== undefined) {
      itemConditions.push(
        sql`eligible_item.price >= ${intent.price.minPriceVnd}`,
      );
    }
    if (hasNutritionIntent(intent)) {
      itemConditions.push(
        sql`eligible_nutrition.verified_by_restaurant = true`,
      );
    }
    if (intent.nutrition.proteinMinG !== undefined) {
      itemConditions.push(
        sql`eligible_nutrition.protein >= ${intent.nutrition.proteinMinG}`,
      );
    }
    if (intent.nutrition.caloriesMax !== undefined) {
      itemConditions.push(
        sql`eligible_nutrition.calories <= ${intent.nutrition.caloriesMax}`,
      );
    }
    if (intent.nutrition.fatMaxG !== undefined) {
      itemConditions.push(
        sql`eligible_nutrition.fat <= ${intent.nutrition.fatMaxG}`,
      );
    }
    if (intent.nutrition.carbsMaxG !== undefined) {
      itemConditions.push(
        sql`eligible_nutrition.carbs <= ${intent.nutrition.carbsMaxG}`,
      );
    }

    conditions.push(sql`EXISTS (
      SELECT 1
      FROM menu_items eligible_item
      LEFT JOIN menu_item_nutrition eligible_nutrition
        ON eligible_nutrition.menu_item_id = eligible_item.id
      WHERE ${sql.join(itemConditions, sql` AND `)}
    )`);
  }

  private buildItemBranchCondition(
    filters: AiSearchRepositoryFilters,
  ): SQL<unknown> | undefined {
    const { branch, intent } = filters;
    const terms = unique([
      ...intent.foodTerms,
      ...intent.dietaryTags,
      ...intent.cuisineTerms,
    ]);

    if (branch === 'fulltext') {
      return this.buildItemFullTextCondition(filters);
    }

    if (branch === 'trigram') {
      return this.buildItemTrigramCondition(filters);
    }

    if (branch === 'semantic') {
      return this.buildItemSemanticCondition(filters);
    }

    if (branch === 'lexical' || branch === 'tag') {
      return this.buildItemTermCondition(terms);
    }

    if (branch === 'nutrition' && hasNutritionIntent(intent)) {
      return sql`${menuItemNutrition.verifiedByRestaurant} = true`;
    }

    if (branch === 'price' && intent.price.maxPriceVnd !== undefined) {
      return sql`${menuItems.price} <= ${intent.price.maxPriceVnd}`;
    }

    if (branch === 'rating' && intent.rating.minAverageRating !== undefined) {
      return sql`${restaurants.averageRating} >= ${intent.rating.minAverageRating}`;
    }

    if (
      branch === 'geo' &&
      filters.lat !== undefined &&
      filters.lon !== undefined
    ) {
      return sql`${restaurants.latitude} IS NOT NULL AND ${restaurants.longitude} IS NOT NULL`;
    }

    return undefined;
  }

  private buildRestaurantBranchCondition(
    filters: AiSearchRepositoryFilters,
  ): SQL<unknown> | undefined {
    const { branch, intent } = filters;
    const terms = unique([
      ...intent.foodTerms,
      ...intent.dietaryTags,
      ...intent.cuisineTerms,
    ]);

    if (branch === 'fulltext') {
      return this.buildRestaurantFullTextCondition(filters);
    }

    if (branch === 'trigram') {
      return this.buildRestaurantTrigramCondition(filters);
    }

    if (branch === 'semantic') {
      return this.buildRestaurantSemanticCondition(filters);
    }

    if (branch === 'lexical' || branch === 'tag') {
      return this.buildRestaurantTermCondition(terms);
    }

    if (branch === 'rating' && intent.rating.minAverageRating !== undefined) {
      return sql`${restaurants.averageRating} >= ${intent.rating.minAverageRating}`;
    }

    if (
      branch === 'geo' &&
      filters.lat !== undefined &&
      filters.lon !== undefined
    ) {
      return sql`${restaurants.latitude} IS NOT NULL AND ${restaurants.longitude} IS NOT NULL`;
    }

    return undefined;
  }

  private buildItemFullTextCondition(
    filters: AiSearchRepositoryFilters,
  ): SQL<unknown> {
    if (!filters.normalizedQuery) return sql`false`;

    return sql`${menuItems.searchDocument} IS NOT NULL
      AND to_tsvector('simple', ${menuItems.searchDocument})
        @@ websearch_to_tsquery('simple', ${filters.normalizedQuery})`;
  }

  private buildRestaurantFullTextCondition(
    filters: AiSearchRepositoryFilters,
  ): SQL<unknown> {
    if (!filters.normalizedQuery) return sql`false`;

    return sql`${restaurants.searchDocument} IS NOT NULL
      AND to_tsvector('simple', ${restaurants.searchDocument})
        @@ websearch_to_tsquery('simple', ${filters.normalizedQuery})`;
  }

  private buildItemTrigramCondition(
    filters: AiSearchRepositoryFilters,
  ): SQL<unknown> {
    if (!filters.normalizedQuery) return sql`false`;

    return sql`${menuItems.searchDocument} IS NOT NULL
      AND similarity(${menuItems.searchDocument}, ${filters.normalizedQuery})
        >= ${TRIGRAM_MIN_SIMILARITY}`;
  }

  private buildRestaurantTrigramCondition(
    filters: AiSearchRepositoryFilters,
  ): SQL<unknown> {
    if (!filters.normalizedQuery) return sql`false`;

    return sql`${restaurants.searchDocument} IS NOT NULL
      AND similarity(${restaurants.searchDocument}, ${filters.normalizedQuery})
        >= ${TRIGRAM_MIN_SIMILARITY}`;
  }

  private buildItemSemanticCondition(
    filters: AiSearchRepositoryFilters,
  ): SQL<unknown> {
    if (
      !filters.queryEmbedding ||
      !filters.embeddingModel ||
      !filters.embeddingVersion
    ) {
      return sql`false`;
    }

    return sql`${menuItems.embedding} IS NOT NULL
      AND ${menuItems.searchDocument} IS NOT NULL
      AND ${menuItems.searchContentHash} IS NOT NULL
      AND ${menuItems.embeddingGeneratedAt} IS NOT NULL
      AND ${menuItems.embeddingModel} = ${filters.embeddingModel}
      AND ${menuItems.embeddingVersion} = ${filters.embeddingVersion}`;
  }

  private buildRestaurantSemanticCondition(
    filters: AiSearchRepositoryFilters,
  ): SQL<unknown> {
    if (
      !filters.queryEmbedding ||
      !filters.embeddingModel ||
      !filters.embeddingVersion
    ) {
      return sql`false`;
    }

    return sql`${restaurants.embedding} IS NOT NULL
      AND ${restaurants.searchDocument} IS NOT NULL
      AND ${restaurants.searchContentHash} IS NOT NULL
      AND ${restaurants.embeddingGeneratedAt} IS NOT NULL
      AND ${restaurants.embeddingModel} = ${filters.embeddingModel}
      AND ${restaurants.embeddingVersion} = ${filters.embeddingVersion}`;
  }

  private buildItemTermCondition(terms: string[]): SQL<unknown> | undefined {
    if (terms.length === 0) return undefined;

    const predicates = terms.flatMap((term) => [
      sql`unaccent(${menuItems.name}) ILIKE unaccent(${'%' + term + '%'})`,
      sql`unaccent(${menuItems.description}) ILIKE unaccent(${'%' + term + '%'})`,
      sql`${term} = ANY(${menuItems.tags})`,
      sql`EXISTS (
        SELECT 1 FROM menu_categories mc
        WHERE mc.id = ${menuItems.categoryId}
          AND unaccent(mc.name) ILIKE unaccent(${'%' + term + '%'})
      )`,
      sql`unaccent(${restaurants.cuisineType}) ILIKE unaccent(${'%' + term + '%'})`,
    ]);

    return or(...predicates);
  }

  private buildRestaurantTermCondition(
    terms: string[],
  ): SQL<unknown> | undefined {
    if (terms.length === 0) return undefined;

    const predicates = terms.flatMap((term) => [
      sql`unaccent(${restaurants.name}) ILIKE unaccent(${'%' + term + '%'})`,
      sql`unaccent(${restaurants.cuisineType}) ILIKE unaccent(${'%' + term + '%'})`,
      sql`unaccent(${restaurants.description}) ILIKE unaccent(${'%' + term + '%'})`,
      sql`EXISTS (
        SELECT 1 FROM menu_items mi
        WHERE mi.restaurant_id = ${restaurants.id}
          AND mi.status = 'available'
          AND (
            unaccent(mi.name) ILIKE unaccent(${'%' + term + '%'})
            OR ${term} = ANY(mi.tags)
          )
      )`,
    ]);

    return or(...predicates);
  }

  private applyGeoConditions(
    conditions: SQL<unknown>[],
    filters: AiSearchRepositoryFilters,
  ): void {
    if (filters.lat === undefined || filters.lon === undefined) return;

    conditions.push(
      sql`${restaurants.latitude} IS NOT NULL AND ${restaurants.longitude} IS NOT NULL`,
    );

    const latDelta = filters.radiusKm / 111.0;
    const lonDelta =
      filters.radiusKm / (111.0 * Math.cos((filters.lat * Math.PI) / 180));

    conditions.push(
      sql`${restaurants.latitude} BETWEEN ${filters.lat - latDelta} AND ${filters.lat + latDelta}`,
    );
    conditions.push(
      sql`${restaurants.longitude} BETWEEN ${filters.lon - lonDelta} AND ${filters.lon + lonDelta}`,
    );

    conditions.push(sql`(
      2 * ${EARTH_RADIUS_KM} * ASIN(SQRT(
        POWER(SIN(RADIANS(${restaurants.latitude} - ${filters.lat}) / 2), 2) +
        COS(RADIANS(${filters.lat})) * COS(RADIANS(${restaurants.latitude})) *
        POWER(SIN(RADIANS(${restaurants.longitude} - ${filters.lon}) / 2), 2)
      ))
    ) <= ${filters.radiusKm}`);
  }

  private buildDistanceExpr(filters: AiSearchRepositoryFilters): SQL<unknown> {
    if (filters.lat === undefined || filters.lon === undefined) {
      return sql<null>`null`;
    }

    return sql<number>`(
      2 * ${EARTH_RADIUS_KM} * ASIN(SQRT(
        POWER(SIN(RADIANS(${restaurants.latitude} - ${filters.lat}) / 2), 2) +
        COS(RADIANS(${filters.lat})) * COS(RADIANS(${restaurants.latitude})) *
        POWER(SIN(RADIANS(${restaurants.longitude} - ${filters.lon}) / 2), 2)
      ))
    )`;
  }

  private buildItemBranchScoreExpr(
    filters: AiSearchRepositoryFilters,
    distanceExpr: SQL<unknown>,
  ): SQL<number> {
    if (filters.branch === 'fulltext' && filters.normalizedQuery) {
      return sql<number>`LEAST(
        1,
        COALESCE(
          ts_rank_cd(
            to_tsvector('simple', ${menuItems.searchDocument}),
            websearch_to_tsquery('simple', ${filters.normalizedQuery})
          ),
          0
        ) * 4
      )`;
    }

    if (filters.branch === 'trigram' && filters.normalizedQuery) {
      return sql<number>`GREATEST(
        0,
        LEAST(1, similarity(${menuItems.searchDocument}, ${filters.normalizedQuery}))
      )`;
    }

    if (filters.branch === 'semantic' && filters.queryEmbedding) {
      const distance = this.buildItemVectorDistanceExpr(filters);
      return sql<number>`GREATEST(0, LEAST(1, 1 - (${distance})))`;
    }

    if (
      filters.branch === 'nutrition' &&
      filters.intent.nutrition.proteinMinG !== undefined
    ) {
      return sql<number>`LEAST(
        1,
        COALESCE(${menuItemNutrition.protein}, 0)
          / ${filters.intent.nutrition.proteinMinG}
      )`;
    }

    if (
      filters.branch === 'nutrition' &&
      filters.intent.nutrition.lowerCalorie
    ) {
      return sql<number>`GREATEST(
        0,
        LEAST(1, 1 - (COALESCE(${menuItemNutrition.calories}, 5000) / 5000.0))
      )`;
    }

    if (
      filters.branch === 'price' &&
      filters.intent.price.maxPriceVnd !== undefined
    ) {
      return sql<number>`GREATEST(
        0,
        LEAST(
          1,
          1 - (${menuItems.price}::float / ${filters.intent.price.maxPriceVnd})
        )
      )`;
    }

    if (
      filters.branch === 'rating' &&
      filters.intent.rating.minAverageRating !== undefined
    ) {
      return sql<number>`LEAST(1, COALESCE(${restaurants.averageRating}, 0) / 5)`;
    }

    if (
      filters.branch === 'geo' &&
      filters.lat !== undefined &&
      filters.lon !== undefined
    ) {
      return sql<number>`GREATEST(
        0,
        LEAST(1, 1 - ((${distanceExpr}) / ${filters.radiusKm}))
      )`;
    }

    return sql<number>`0.6::float`;
  }

  private buildRestaurantBranchScoreExpr(
    filters: AiSearchRepositoryFilters,
    distanceExpr: SQL<unknown>,
  ): SQL<number> {
    if (filters.branch === 'fulltext' && filters.normalizedQuery) {
      return sql<number>`LEAST(
        1,
        COALESCE(
          ts_rank_cd(
            to_tsvector('simple', ${restaurants.searchDocument}),
            websearch_to_tsquery('simple', ${filters.normalizedQuery})
          ),
          0
        ) * 4
      )`;
    }

    if (filters.branch === 'trigram' && filters.normalizedQuery) {
      return sql<number>`GREATEST(
        0,
        LEAST(1, similarity(${restaurants.searchDocument}, ${filters.normalizedQuery}))
      )`;
    }

    if (filters.branch === 'semantic' && filters.queryEmbedding) {
      const distance = this.buildRestaurantVectorDistanceExpr(filters);
      return sql<number>`GREATEST(0, LEAST(1, 1 - (${distance})))`;
    }

    if (
      filters.branch === 'rating' &&
      filters.intent.rating.minAverageRating !== undefined
    ) {
      return sql<number>`LEAST(1, COALESCE(${restaurants.averageRating}, 0) / 5)`;
    }

    if (
      filters.branch === 'geo' &&
      filters.lat !== undefined &&
      filters.lon !== undefined
    ) {
      return sql<number>`GREATEST(
        0,
        LEAST(1, 1 - ((${distanceExpr}) / ${filters.radiusKm}))
      )`;
    }

    return sql<number>`0.6::float`;
  }

  private buildItemOrderBy(
    filters: AiSearchRepositoryFilters,
    branchScoreExpr: SQL<number>,
    distanceExpr: SQL<unknown>,
  ): SQL<unknown>[] {
    if (
      filters.branch === 'nutrition' &&
      filters.intent.nutrition.lowerCalorie
    ) {
      return [
        sql`${menuItemNutrition.calories} ASC`,
        sql`${branchScoreExpr} DESC`,
      ];
    }
    if (filters.branch === 'semantic' && filters.queryEmbedding) {
      return [sql`${this.buildItemVectorDistanceExpr(filters)} ASC`];
    }
    if (
      filters.branch === 'geo' &&
      filters.lat !== undefined &&
      filters.lon !== undefined
    ) {
      return [sql`${distanceExpr} ASC`];
    }
    return [
      sql`${branchScoreExpr} DESC`,
      sql`${restaurants.averageRating} DESC`,
      sql`${restaurants.reviewCount} DESC`,
    ];
  }

  private buildRestaurantOrderBy(
    filters: AiSearchRepositoryFilters,
    branchScoreExpr: SQL<number>,
    distanceExpr: SQL<unknown>,
  ): SQL<unknown>[] {
    if (filters.branch === 'semantic' && filters.queryEmbedding) {
      return [sql`${this.buildRestaurantVectorDistanceExpr(filters)} ASC`];
    }
    if (
      filters.branch === 'geo' &&
      filters.lat !== undefined &&
      filters.lon !== undefined
    ) {
      return [sql`${distanceExpr} ASC`];
    }
    return [
      sql`${branchScoreExpr} DESC`,
      sql`${restaurants.averageRating} DESC`,
      sql`${restaurants.reviewCount} DESC`,
    ];
  }

  private buildItemVectorDistanceExpr(
    filters: AiSearchRepositoryFilters,
  ): SQL<number> {
    return sql<number>`${menuItems.embedding} <=> ${toVectorLiteral(
      filters.queryEmbedding ?? [],
    )}::vector`;
  }

  private buildRestaurantVectorDistanceExpr(
    filters: AiSearchRepositoryFilters,
  ): SQL<number> {
    return sql<number>`${restaurants.embedding} <=> ${toVectorLiteral(
      filters.queryEmbedding ?? [],
    )}::vector`;
  }
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function hasNutritionIntent(intent: AiSearchIntent): boolean {
  return (
    Boolean(intent.nutrition.lowerCalorie) ||
    intent.nutrition.proteinMinG !== undefined ||
    intent.nutrition.caloriesMax !== undefined ||
    intent.nutrition.fatMaxG !== undefined ||
    intent.nutrition.carbsMaxG !== undefined
  );
}

function numberOrZero(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function buildPopularitySignals(row: {
  deliveredOrderCount30d: unknown;
  deliveredOrderCount90d: unknown;
  orderedQuantity30d: unknown;
  orderedQuantity90d: unknown;
  lastOrderedAt: Date | null;
  updatedAt: Date | null;
}): AiSearchPopularitySignals | null {
  if (row.updatedAt === null || row.updatedAt === undefined) return null;

  return {
    deliveredOrderCount30d: numberOrZero(row.deliveredOrderCount30d),
    deliveredOrderCount90d: numberOrZero(row.deliveredOrderCount90d),
    orderedQuantity30d: numberOrZero(row.orderedQuantity30d),
    orderedQuantity90d: numberOrZero(row.orderedQuantity90d),
    lastOrderedAt: row.lastOrderedAt ?? null,
    updatedAt: row.updatedAt,
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding
    .map((value) => (Number.isFinite(value) ? value : 0))
    .join(',')}]`;
}
