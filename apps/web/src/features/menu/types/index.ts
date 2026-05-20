export type MenuItemStatus = 'available' | 'unavailable' | 'out_of_stock';

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
  createdAt: string;
  updatedAt: string;
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
