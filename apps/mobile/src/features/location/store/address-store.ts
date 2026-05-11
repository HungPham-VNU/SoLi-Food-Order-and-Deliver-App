import { create } from 'zustand';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface AddressState {
  selectedAddress: string;
  latitude: number | null;
  longitude: number | null;
  setSelectedAddress: (address: string, coords?: Coordinates | null) => void;
}

export const useAddressStore = create<AddressState>((set) => ({
  selectedAddress: 'Asia Square Tower 2',
  latitude: null,
  longitude: null,
  setSelectedAddress: (address, coords) =>
    set({
      selectedAddress: address,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    }),
}));
