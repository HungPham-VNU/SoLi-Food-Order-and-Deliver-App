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
  averageRating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantListResponse {
  data: Restaurant[];
  total: number;
}
