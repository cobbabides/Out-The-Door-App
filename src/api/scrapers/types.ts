export type EventCategory =
  | "music"
  | "film"
  | "arts"
  | "food"
  | "comedy"
  | "sports"
  | "outdoor"
  | "community"
  | "other";

export interface LocalEvent {
  id: string;
  title: string;
  venue: string;
  address?: string;
  date: string;         // YYYY-MM-DD
  time?: string;        // "8:00 PM"
  endTime?: string;
  description?: string;
  url?: string;
  image?: string;
  price?: string;
  category: EventCategory;
  source: string;       // which scraper produced this
}
