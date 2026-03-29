import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SavedItem {
  id: string;
  type: "place" | "event" | "movie" | "localEvent";
  title: string;
  subtitle: string;
  category: string;
  emoji: string;
  image?: string;
  url?: string;
  savedAt: string; // ISO timestamp
}

interface SavedState {
  items: SavedItem[];
  toggle: (item: SavedItem) => void;
  isSaved: (id: string) => boolean;
  clear: () => void;
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      items: [],

      toggle: (item: SavedItem) => {
        const current = get().items;
        const exists = current.some((i) => i.id === item.id);
        if (exists) {
          set({ items: current.filter((i) => i.id !== item.id) });
        } else {
          set({ items: [{ ...item, savedAt: new Date().toISOString() }, ...current] });
        }
      },

      isSaved: (id: string) => get().items.some((i) => i.id === id),

      clear: () => set({ items: [] }),
    }),
    {
      name: "outd-saved-v1",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
