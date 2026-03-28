export interface QNode {
  id: string;
  prompt: string;
  options: { label: string; value: string; next?: string }[];
  fallbackId?: string;
}

export const tree: Record<string, QNode> = {
  people: {
    id: "people",
    prompt: "Flying solo or want to be around people?",
    options: [
      { label: "Solo", value: "solo", next: "timeframe" },
      { label: "People", value: "people", next: "timeframe" },
    ],
  },
  timeframe: {
    id: "timeframe",
    prompt: "When are you thinking?",
    options: [
      { label: "Right now", value: "now", next: "distance" },
      { label: "Later tonight", value: "tonight", next: "distance" },
      { label: "This weekend", value: "weekend", next: "distance" },
    ],
  },
  distance: {
    id: "distance",
    prompt: "Stick close or go explore?",
    options: [
      { label: "Close by", value: "close", next: "category" },
      { label: "I'll go further", value: "far", next: "category" },
    ],
    fallbackId: "category",
  },
  category: {
    id: "category",
    prompt: "What kind of thing?",
    options: [
      { label: "Food & drink", value: "food" },
      { label: "Art & culture", value: "art" },
      { label: "Outside", value: "nature" },
      { label: "Movies", value: "movies" },
      { label: "Surprise me", value: "random" },
    ],
  },
};
