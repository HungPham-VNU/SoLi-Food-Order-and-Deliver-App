import { create } from 'zustand';

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
  coords?: Coordinates | null;
}

interface AddressState {
  selectedAddress: string;
  latitude: number | null;
  longitude: number | null;
  savedAddresses: SavedAddress[];
  recentSearches: RecentSearch[];
  setSelectedAddress: (address: string, coords?: Coordinates | null) => void;
  addSavedAddress: (address: Omit<SavedAddress, 'id'>) => void;
}

export const useAddressStore = create<AddressState>((set) => ({
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
}));
