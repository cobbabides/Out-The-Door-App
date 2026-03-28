import { create } from "zustand";
import { AppContext } from "../utils/buildContext";

export type Mood =
  | "chill"
  | "social"
  | "active"
  | "creative"
  | "lazy"
  | "surprise";

export interface Answers {
  people?: string;
  timeframe?: string; // "now" | "tonight" | "weekend"
  distance?: string;
  category?: string;
}

interface AppState {
  mood: Mood | null;
  answers: Answers;
  currentQuestionId: string;
  context: AppContext | null;

  setMood: (mood: Mood) => void;
  setAnswer: (key: keyof Answers, value: string) => void;
  nextQuestion: (nextId: string) => void;
  setContext: (ctx: AppContext) => void;
  reset: () => void;
}

const initialState = {
  mood: null,
  answers: {},
  currentQuestionId: "people",
  context: null,
};

export const useStore = create<AppState>((set) => ({
  ...initialState,

  setMood: (mood) => set({ mood }),

  setAnswer: (key, value) =>
    set((state) => ({
      answers: { ...state.answers, [key]: value },
    })),

  nextQuestion: (nextId) => set({ currentQuestionId: nextId }),

  setContext: (ctx) => set({ context: ctx }),

  reset: () => set(initialState),
}));
