import { create } from "zustand";

export interface PlanAnchor {
  title: string;
  venue: string;
  time?: string;
  date?: string;
  category: string;
  emoji: string;
  url?: string;
  address?: string;
}

interface PlanState {
  anchor: PlanAnchor | null;
  setAnchor: (anchor: PlanAnchor) => void;
  clear: () => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  anchor: null,
  setAnchor: (anchor) => set({ anchor }),
  clear: () => set({ anchor: null }),
}));
