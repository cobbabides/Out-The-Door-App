import { create } from "zustand";
import { AppContext } from "../utils/buildContext";
import { MOOD_FIRST_QUESTION } from "../utils/decisionTree";

export type Mood =
  | "chill"
  | "social"
  | "active"
  | "creative"
  | "lazy"
  | "surprise";

export interface Answers {
  timeframe?: string;   // "now" | "tonight" | "weekend"
  distance?: string;    // "close" | "far"
  category?: string;    // "food" | "bar" | "music" | "outdoor" | "explore" |
                        // "movies" | "experience" | "make" | "home" | "random"
  setting?: string;     // "indoor" | "outdoor"
  budget?: string;      // "low" | "mid" | "high"
  energy?: string;      // "low" | "medium" | "high"
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
  currentQuestionId: "chill_env", // overwritten when mood is picked
  context: null,
};

export const useStore = create<AppState>((set) => ({
  ...initialState,

  setMood: (mood) =>
    set({
      mood,
      currentQuestionId: MOOD_FIRST_QUESTION[mood] ?? "chill_env",
    }),

  setAnswer: (key, value) =>
    set((state) => ({
      answers: { ...state.answers, [key]: value },
    })),

  nextQuestion: (nextId) => set({ currentQuestionId: nextId }),

  setContext: (ctx) => set({ context: ctx }),

  reset: () => set(initialState),
}));
