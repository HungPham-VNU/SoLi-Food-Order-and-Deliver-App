// ─── Product Types ────────────────────────────────────────────────────────────

export interface NutritionInfo {
  calories: number;
  fat: string;
  carbs: string;
  protein: string;
}

export interface RelatedProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl: string;
}

export interface Product {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  priceUnit: string;
  description: string;
  imageUrl: string;
  badge?: string;
  nutrition: NutritionInfo;
  relatedProducts: RelatedProduct[];
  isFavorited?: boolean;
}

// ─── Restaurant Types ─────────────────────────────────────────────────────────

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  categoryId?: string;
  status: 'available' | 'unavailable' | 'out_of_stock';
  imageUrl?: string;
  tags?: string[];
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number | null;
    sugar: number | null;
    sodium: number | null;
    source: 'AI_ESTIMATED' | 'MANUALLY_ENTERED' | 'VERIFIED_BY_RESTAURANT';
    verifiedByRestaurant: boolean;
    disclaimer: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemListResponse {
  data: MenuItem[];
  total: number;
}

export interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  price: number;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface ModifierGroup {
  id: string;
  menuItemId: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

export interface Restaurant {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  address: string;
  phone: string;
  isOpen: boolean;
  isApproved: boolean;
  latitude?: number | null;
  longitude?: number | null;
  cuisineType?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  averageRating?: number;
  ratingSum?: number;
  reviewCount?: number;
  // UI-specific extensions (may not be in API yet)
  rating?: number;
  deliveryTime?: string;
  deliveryFee?: number;
}

export interface RestaurantListResponse {
  data: Restaurant[];
  total: number;
}

export interface RestaurantSearchResult {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  phone: string;
  isOpen: boolean;
  latitude?: number | null;
  longitude?: number | null;
  cuisineType?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  distanceKm?: number | null;
  score?: number;
  createdAt: string;
  updatedAt: string;
  averageRating?: number;
  ratingSum?: number;
  reviewCount?: number;
  // UI-specific extensions (may not be in API yet)
  rating?: number;
  deliveryTime?: string;
  deliveryFee?: number;
}

export interface RestaurantSearchSummary {
  id: string;
  name: string;
  address: string;
  cuisineType?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  averageRating?: number;
  ratingSum?: number;
  reviewCount?: number;
}

export interface SearchItemResult {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  tags?: string[];
  categoryName?: string | null;
  score?: number;
  restaurant: RestaurantSearchSummary;
}

export interface UnifiedSearchTotals {
  restaurants: number;
  items: number;
}

export interface UnifiedSearchResponse {
  restaurants: RestaurantSearchResult[];
  items: SearchItemResult[];
  total: UnifiedSearchTotals;
}

export interface AiSearchAppliedFilter {
  key: string;
  label: string;
  source: 'request' | 'ai_inferred' | 'system_default';
}

export interface AiSearchFollowUp {
  label: string;
  query: string;
}

export interface AiSearchNutritionFacts {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  verifiedByRestaurant: boolean | null;
}

export interface AiSearchItemResult extends SearchItemResult {
  score: number;
  matchReasons: string[];
  nutrition?: AiSearchNutritionFacts | null;
}

export interface AiSearchResponse {
  mode: 'ai' | 'classic_fallback';
  query: string;
  interpretation: string;
  appliedFilters: AiSearchAppliedFilter[];
  restaurants: RestaurantSearchResult[];
  items: AiSearchItemResult[];
  total: UnifiedSearchTotals;
  followUps: AiSearchFollowUp[];
  fallback: null | {
    reason: string;
  };
}

// ─── Delivery Estimate Types ───────────────────────────────────────────────────

export interface DeliveryEstimateQuery {
  lat: number;
  lon: number;
}

export interface DeliveryFeeBreakdown {
  baseFee: number;
  distanceFee: number;
  prepTimeMinutes: number;
  travelTimeMinutes: number;
  bufferMinutes: number;
}

export interface DeliveryEstimateResponse {
  restaurantId: string;
  distanceKm: number;
  zone: {
    id: string;
    name: string;
    radiusKm: number;
  };
  deliveryFee: number;
  estimatedMinutes: number;
  breakdown: DeliveryFeeBreakdown;
}

// ─── Screen Props ──────────────────────────────────────────────────────────────

export interface ProductDetailScreenProps {
  productId: string;
  onBack?: () => void;
  onFavoriteToggle?: (productId: string) => void;
  onAddToCart?: (productId: string, quantity: number) => void;
  onViewAllRelated?: () => void;
  onRelatedProductAdd?: (productId: string) => void;
  onTabPress?: (tabId: string) => void;
}

export interface RestaurantMenuScreenProps {
  restaurantId: string;
  onBack?: () => void;
  onFavoriteToggle?: (restaurantId: string) => void;
  onItemPress?: (itemId: string) => void;
  onAddItem?: (itemId: string) => void;
  onTabPress?: (tabId: string) => void;
  isAddingToCart?: boolean;
}

export interface MenuItemDetailScreenProps {
  itemId: string;
  onBack?: () => void;
  onFavoriteToggle?: (itemId: string) => void;
  isAddingToCart?: boolean;
  onAddToCart?: (
    itemId: string,
    quantity: number,
    modifierSelections: Record<string, string[]>,
    isUpdate?: boolean,
    optimisticSelectedModifiers?: import('@/src/features/cart').SelectedModifierResponse[],
  ) => void;
}
