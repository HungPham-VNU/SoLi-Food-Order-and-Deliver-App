import { create } from 'zustand';

import type { Coordinates } from '../types';

export interface SavedAddress {
  id: string;
  type: 'home' | 'work' | 'other';
  label: string;
  address: string;
  coords: Coordinates;
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
}

export const useAddressStore = create<AddressState>((set) => ({
  selectedAddress: 'Asia Square Tower 2',
  latitude: null,
  longitude: null,
  savedAddresses: [
    {
      id: '1',
      type: 'home',
      label: 'Home',
      address: '1242 Orchard Lane, Green Valley',
      coords: { latitude: 10.8931869, longitude: 106.7918481 },
    },
    {
      id: '2',
      type: 'work',
      label: 'Creative Studio',
      address: '88 Artisans Way, Suite 400',
      coords: { latitude: 10.762622, longitude: 106.660172 },
    },
  ],
  recentSearches: [
    {
      id: 'r1',
      address: '241 Maple Avenue, North Hills',
      coords: { latitude: 10.774, longitude: 106.701 },
    },
    {
      id: 'r2',
      address: 'Farmers Market Plaza, Downtown',
      coords: { latitude: 10.771, longitude: 106.704 },
    },
  ],
  setSelectedAddress: (address, coords) =>
    set({
      selectedAddress: address,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    }),
}));
