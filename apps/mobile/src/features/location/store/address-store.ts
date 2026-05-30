import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Coordinates } from '../types';

export interface SavedAddress {
  id: string;
  type: 'home' | 'work' | 'other';
  label: string;
  address: string;
  coords: Coordinates;
  phone?: string;
}

export interface RecentSearch {
  id: string;
  address: string;
  label?: string;
  subtitle?: string;
  coords?: Coordinates | null;
  searchedAt: number;
}

const MAX_RECENT_SEARCHES = 10;

interface AddressState {
  selectedAddress: string;
  latitude: number | null;
  longitude: number | null;
  savedAddresses: SavedAddress[];
  recentSearches: RecentSearch[];
  setSelectedAddress: (address: string, coords?: Coordinates | null) => void;
  addSavedAddress: (address: Omit<SavedAddress, 'id'>) => void;
  removeSavedAddress: (id: string) => void;
  addRecentSearch: (address: string, coords?: Coordinates | null, subtitle?: string, label?: string) => void;
  clearRecentSearches: () => void;
}

export const useAddressStore = create<AddressState>()(
  persist(
    (set) => ({
      selectedAddress: '',
      latitude: null,
      longitude: null,
      savedAddresses: [],
      recentSearches: [],
      setSelectedAddress: (address, coords) =>
        set({
          selectedAddress: address,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        }),
      addSavedAddress: (address) =>
        set((state) => ({
          savedAddresses: [
            ...state.savedAddresses,
            { ...address, id: Math.random().toString(36).substring(2, 9) },
          ],
        })),
      removeSavedAddress: (id) =>
        set((state) => ({
          savedAddresses: state.savedAddresses.filter((a) => a.id !== id),
        })),
      addRecentSearch: (address, coords, subtitle, label) => {
        if (!address.trim()) return;
        set((state) => {
          // Remove any duplicate of the same address
          const filtered = state.recentSearches.filter(
            (r) => r.address.toLowerCase() !== address.toLowerCase(),
          );
          const entry: RecentSearch = {
            id: Math.random().toString(36).substring(2, 9),
            address: address.trim(),
            label: label?.trim() || undefined,
            subtitle: subtitle?.trim() || undefined,
            coords: coords ?? null,
            searchedAt: Date.now(),
          };
          return {
            recentSearches: [entry, ...filtered].slice(0, MAX_RECENT_SEARCHES),
          };
        });
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: 'address-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the address lists, not the ephemeral selected address / coords
      partialize: (state) => ({
        savedAddresses: state.savedAddresses,
        recentSearches: state.recentSearches,
      }),
    },
  ),
);
