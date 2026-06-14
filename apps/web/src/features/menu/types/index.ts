export type MenuItemStatus = 'available' | 'unavailable' | 'out_of_stock';
export type NutritionUnit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tbsp'
  | 'tsp'
  | 'piece'
  | 'cup'
  | 'unknown';

export type PreparationState =
  | 'raw'
  | 'cooked'
  | 'fried'
  | 'boiled'
  | 'grilled'
  | 'steamed'
  | 'unknown';

export type NutritionAnalysisStatus =
  | 'ANALYZED'
  | 'NEEDS_REVIEW'
  | 'CALCULATED'
  | 'SAVED'
  | 'FAILED';

export interface MenuItemNutrition {
  servings: number;
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
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string | null;
  price: number;
  sku?: string | null;
  categoryId?: string | null;
  status: MenuItemStatus;
  imageUrl?: string | null;
  tags?: string[] | null;
  nutrition?: MenuItemNutrition | null;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionReviewIngredient {
  rawText?: string | null;
  name: string;
  quantity: number | null;
  unit: NutritionUnit;
  preparation?: PreparationState;
  confidence?: number;
  requiresConfirmation?: boolean;
  notes?: string[];
}

export interface AnalyzeRecipeResponse {
  analysisSessionId: string;
  recipeName: string | null;
  servings: number | null;
  ingredients: NutritionReviewIngredient[];
  warnings: string[];
  status: NutritionAnalysisStatus;
}

export interface MenuItemNutritionAnalysis extends AnalyzeRecipeResponse {
  recipeText: string;
}

export interface CalculateNutritionRequest {
  analysisSessionId: string;
  servings: number;
  ingredients: Array<{
    name: string;
    quantity: number | null;
    unit: NutritionUnit;
    preparation?: PreparationState;
  }>;
}

export interface MatchedNutritionIngredient {
  inputName: string;
  matchedFoodId: string | null;
  matchedName: string | null;
  quantityGram: number | null;
  matchConfidence: number;
  requiresConfirmation: boolean;
  warnings: string[];
  candidates?: Array<{
    matchedFoodId: string;
    matchedName: string;
    matchedNameEn: string;
    state: string;
    matchConfidence: number;
  }>;
}

export interface NutritionAmount {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
}

export interface CalculateNutritionResponse {
  matchedIngredients: MatchedNutritionIngredient[];
  nutrition: {
    total: NutritionAmount;
    perServing: NutritionAmount;
  };
  warnings: string[];
}

export interface SaveNutritionRequest {
  analysisSessionId: string;
  servings: number;
  nutrition: NutritionAmount;
  ingredients: Array<{
    name: string;
    quantityGram: number;
    matchedFoodId: string | null;
  }>;
  verifiedByRestaurant: true;
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemListResponse {
  data: MenuItem[];
  total: number;
}

export interface MenuOverview {
  totalItems: number;
  availableItems: number;
  unavailableItems: number;
  outOfStockItems: number;
  categories: MenuCategory[];
}

export interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  price: number;
  isDefault: boolean;
  displayOrder: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModifierGroup {
  id: string;
  menuItemId: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  displayOrder: number;
  options: ModifierOption[];
  createdAt: string;
  updatedAt: string;
}
