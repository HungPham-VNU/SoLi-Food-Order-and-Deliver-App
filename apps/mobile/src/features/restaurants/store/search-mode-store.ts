import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SearchMode = 'classic' | 'ai';

interface SearchModeState {
  mode: SearchMode;
  setMode: (mode: SearchMode) => void;
  toggleMode: () => void;
}

export const useSearchModeStore = create<SearchModeState>()(
  persist(
    (set) => ({
      mode: 'classic',
      setMode: (mode) => set({ mode }),
      toggleMode: () =>
        set((state) => ({
          mode: state.mode === 'ai' ? 'classic' : 'ai',
        })),
    }),
    {
      name: 'restaurant-search-mode-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
);

