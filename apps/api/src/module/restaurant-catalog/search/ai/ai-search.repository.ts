import { Inject, Injectable } from '@nestjs/common';
import { and, eq, or, SQL, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import * as schema from '@/drizzle/schema';
import { menuItemNutrition } from '@/module/nutrition/domain/nutrition.schema';
import {
  menuCategories,
  menuItems,
  menuItemStatusEnum,
} from '../../menu/menu.schema';
import { restaurants } from '../../restaurant/restaurant.schema';
import type {
  AiSearchItemCandidate,
  AiSearchRepositoryFilters,
  AiSearchRestaurantCandidate,
} from './ai-search.types';

const EARTH_RADIUS_KM = 6371;

@Injectable()
export class AiSearchRepository {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

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

    const rows = await this.db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        description: menuItems.description,
        price: menuItems.price,
        imageUrl: menuItems.imageUrl,
        tags: menuItems.tags,
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
      })
      .from(menuItems)
      .innerJoin(restaurants, eq(menuItems.restaurantId, restaurants.id))
      .leftJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
      .leftJoin(menuItemNutrition, eq(menuItemNutrition.menuItemId, menuItems.id))
      .where(whereClause)
      .limit(filters.limit);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      imageUrl: row.imageUrl,
      tags: row.tags,
      categoryName: row.categoryName,
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

    const branchCondition = this.buildRestaurantBranchCondition(filters);
    if (branchCondition) conditions.push(branchCondition);

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
        distanceKm: this.buildDistanceExpr(filters),
      })
      .from(restaurants)
      .where(and(...conditions))
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
    }));
  }

  private applyItemHardFilters(
    conditions: SQL<unknown>[],
    filters: AiSearchRepositoryFilters,
  ): void {
    const { intent } = filters;

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
      conditions.push(sql`${menuItemNutrition.fat} <= ${intent.nutrition.fatMaxG}`);
    }
    if (intent.nutrition.carbsMaxG !== undefined) {
      conditions.push(
        sql`${menuItemNutrition.carbs} <= ${intent.nutrition.carbsMaxG}`,
      );
    }
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

    if (branch === 'lexical' || branch === 'tag') {
      return this.buildItemTermCondition(terms);
    }

    if (branch === 'nutrition' && intent.nutrition.proteinMinG !== undefined) {
      return sql`${menuItemNutrition.protein} >= ${intent.nutrition.proteinMinG}`;
    }

    if (branch === 'price' && intent.price.maxPriceVnd !== undefined) {
      return sql`${menuItems.price} <= ${intent.price.maxPriceVnd}`;
    }

    if (branch === 'rating' && intent.rating.minAverageRating !== undefined) {
      return sql`${restaurants.averageRating} >= ${intent.rating.minAverageRating}`;
    }

    if (branch === 'geo' && filters.lat !== undefined && filters.lon !== undefined) {
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

    if (branch === 'lexical' || branch === 'tag') {
      return this.buildRestaurantTermCondition(terms);
    }

    if (branch === 'rating' && intent.rating.minAverageRating !== undefined) {
      return sql`${restaurants.averageRating} >= ${intent.rating.minAverageRating}`;
    }

    if (branch === 'geo' && filters.lat !== undefined && filters.lon !== undefined) {
      return sql`${restaurants.latitude} IS NOT NULL AND ${restaurants.longitude} IS NOT NULL`;
    }

    return undefined;
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
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function numberOrZero(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

