import type { ItemSearchRowDto } from '../standard/search.dto';
import type { RestaurantSearchResultDto } from '../../restaurant/dto/restaurant.dto';

export const AI_SEARCH_DEFAULT_BUDGET_MAX_VND = 50_000;
export const AI_SEARCH_DEFAULT_HIGH_PROTEIN_MIN_G = 25;
export const AI_SEARCH_DEFAULT_HIGH_RATING_MIN = 4.3;
export const AI_SEARCH_DEFAULT_MIN_REVIEW_COUNT = 3;
export const AI_SEARCH_DEFAULT_RADIUS_KM = 5;
export const AI_SEARCH_MIN_CONFIDENCE = 0.65;
export const AI_SEARCH_MAX_QUERY_LENGTH = 300;

export const AI_ITEM_SCORE = {
  exactNameMatch: 25,
  partialNameMatch: 15,
  tagMatch: 10,
  categoryMatch: 8,
  cuisineMatch: 6,
  highProteinMatch: 18,
  budgetMatch: 14,
  highlyRatedMatch: 14,
  nearbyMatch: 12,
  openNow: 8,
  reviewConfidence: 4,
} as const;

export type AiSearchSort =
  | 'relevance'
  | 'distance'
  | 'rating'
  | 'price_asc'
  | 'protein_desc';

export interface AiSearchIntent {
  rewrittenQuery: string;
  language: 'en' | 'vi' | 'unknown';
  foodTerms: string[];
  cuisineTerms: string[];
  dietaryTags: string[];
  excludedTerms: string[];
  nutrition: {
    highProtein?: boolean;
    proteinMinG?: number;
    caloriesMax?: number;
    fatMaxG?: number;
    carbsMaxG?: number;
  };
  price: {
    maxPriceVnd?: number;
    minPriceVnd?: number;
    budgetIntent?: boolean;
  };
  rating: {
    minAverageRating?: number;
    minReviewCount?: number;
  };
  geo: {
    nearbyIntent?: boolean;
    radiusKm?: number;
  };
  sort: AiSearchSort;
  confidence: number;
  needsFallback: boolean;
}

export type AiSearchRetrievalBranch =
  | 'lexical'
  | 'nutrition'
  | 'price'
  | 'rating'
  | 'geo'
  | 'tag';

export interface AiSearchRepositoryFilters {
  intent: AiSearchIntent;
  branch: AiSearchRetrievalBranch;
  lat?: number;
  lon?: number;
  radiusKm: number;
  limit: number;
}

export interface AiSearchNutritionFacts {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  verifiedByRestaurant: boolean | null;
}

export interface AiSearchRestaurantCandidate extends RestaurantSearchResultDto {
  score?: number;
  distanceKm?: number | null;
}

export interface AiSearchItemCandidate extends ItemSearchRowDto {
  nutrition: AiSearchNutritionFacts | null;
  retrievalBranches: AiSearchRetrievalBranch[];
  matchReasons?: string[];
}

export interface AiSearchItemResult extends ItemSearchRowDto {
  score: number;
  matchReasons: string[];
  nutrition?: AiSearchNutritionFacts | null;
}

export type AiSearchMode = 'ai' | 'classic_fallback';

export type AiSearchAppliedFilterSource =
  | 'request'
  | 'ai_inferred'
  | 'system_default';

export interface AiSearchAppliedFilter {
  key: string;
  label: string;
  source: AiSearchAppliedFilterSource;
}

export interface AiSearchFollowUp {
  label: string;
  query: string;
}

export type AiSearchFallbackReason =
  | 'LOW_CONFIDENCE'
  | 'AI_SEARCH_UNAVAILABLE'
  | 'AI_SEARCH_EMPTY_QUERY';

export interface AiSearchResponse {
  mode: AiSearchMode;
  query: string;
  interpretation: string;
  appliedFilters: AiSearchAppliedFilter[];
  restaurants: AiSearchRestaurantCandidate[];
  items: AiSearchItemResult[];
  total: {
    restaurants: number;
    items: number;
  };
  followUps: AiSearchFollowUp[];
  fallback: null | {
    reason: AiSearchFallbackReason;
  };
}
