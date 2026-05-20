import { create } from 'zustand';
import type { Restaurant } from '../api/restaurant.types';

interface RestaurantStore {
  restaurant: Restaurant | null;
  setRestaurant: (restaurant: Restaurant | null) => void;
}

export const useRestaurantStore = create<RestaurantStore>((set) => ({
  restaurant: null,
  setRestaurant: (restaurant) => set({ restaurant }),
}));
