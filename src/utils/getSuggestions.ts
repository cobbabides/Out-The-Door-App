import * as Location from "expo-location";
import { searchPlaces, Place } from "../api/places";
import { searchYelp } from "../api/yelp";
import { buildContext, AppContext, Timeframe } from "./buildContext";
import { Event } from "../api/ticketmaster";
import { Showtime } from "../api/showtimes";
import { LocalEvent, EventCategory } from "../api/scrapers";
import { useStore, Mood, Answers } from "../state/useStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResultType = "place" | "event" | "movie";

export interface PlaceResult {
  type: "place";
  place: Place;
  contextTags: string[];
}

export interface EventResult {
  type: "event";
  event: Event;
  contextTags: string[];
}

export interface MovieResult {
  type: "movie";
  showtime: Showtime;
  contextTags: string[];
}

export interface LocalEventResult {
  type: "localEvent";
  localEvent: LocalEvent;
  contextTags: string[];
}

export type AnyResult = PlaceResult | EventResult | MovieResult | LocalEventResult;

export interface SuggestionSet {
  results: AnyResult[];
  context: AppContext;
}

// ─── Mood → keyword maps ──────────────────────────────────────────────────────

const MOOD_KEYWORDS: Record<Mood, string> = {
  chill: "cafe",
  social: "bar",
  active: "park",
  creative: "art gallery",
  lazy: "cinema",
  surprise: "attraction",
};

const CATEGORY_KEYWORDS: Record<string, string> = {
  // Legacy
  food: "restaurant",
  art: "art gallery",
  nature: "park",
  movies: "cinema",
  random: "point_of_interest",
  // New decision tree values
  bar: "bar",
  music: "music venue",
  outdoor: "park",
  explore: "attraction",
  experience: "museum",
  make: "art studio",
  home: "cafe",
};

const RAINY_OVERRIDES: Record<string, string> = {
  park: "museum",
  nature: "museum",
  active: "indoor climbing",
};

const MOOD_GENRES: Record<Mood, string[]> = {
  chill: ["Jazz", "Classical", "Folk", "Acoustic"],
  social: ["Pop", "Hip-Hop/Rap", "Electronic", "Dance", "R&B"],
  active: ["Rock", "Metal", "Punk", "Alternative"],
  creative: ["Jazz", "Classical", "Arts", "Theatre", "Dance"],
  lazy: ["Comedy", "Film", "Pop"],
  surprise: [],
};

// Which LocalEvent categories fit each mood
const MOOD_LOCAL_CATEGORIES: Record<Mood, EventCategory[]> = {
  chill: ["music", "arts", "food"],
  social: ["music", "comedy", "food", "community"],
  active: ["sports", "outdoor", "community"],
  creative: ["arts", "film", "music", "community"],
  lazy: ["film", "comedy", "arts"],
  surprise: ["music", "arts", "film", "comedy", "sports", "outdoor", "community", "other"],
};

// Which LocalEvent categories fit each user-selected category
const CATEGORY_LOCAL_CATEGORIES: Record<string, EventCategory[]> = {
  // Legacy
  food: ["food", "community"],
  art: ["arts", "film", "music"],
  nature: ["outdoor", "sports"],
  movies: ["film"],
  random: ["music", "arts", "film", "comedy", "sports", "outdoor", "community", "other"],
  // New decision tree values
  bar: ["music", "comedy", "community"],
  music: ["music"],
  outdoor: ["outdoor", "sports"],
  explore: ["outdoor", "community"],
  experience: ["arts", "film", "music"],
  make: ["arts", "community"],
  home: ["film"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(timeStr?: string): string | undefined {
  if (!timeStr) return undefined;
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function buildWeatherTag(ctx: AppContext): string {
  return `${ctx.weather.temp}°F · ${ctx.weather.description}`;
}

function isWithinDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  const now = new Date();
  const diff = (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

function filterEventsByMoodAndTime(
  events: Event[],
  mood: Mood,
  ctx: AppContext
): Event[] {
  const affinityGenres = MOOD_GENRES[mood];
  const todayStr = new Date().toISOString().split("T")[0];

  return events.filter((e) => {
    const isToday = e.date === todayStr;
    const isThisWeekend = isWithinDays(e.date, 3);

    if (ctx.time.timeframe === "now" && !isToday) return false;
    if (ctx.time.timeframe === "tonight" && !isToday) return false;
    if (ctx.time.timeframe === "weekend" && !isThisWeekend) return false;

    if (affinityGenres.length > 0 && e.genre) {
      return affinityGenres.some((g) =>
        e.genre!.toLowerCase().includes(g.toLowerCase())
      );
    }

    return true;
  });
}

function filterLocalEvents(
  events: LocalEvent[],
  mood: Mood | null,
  answers: Answers,
  ctx: AppContext
): LocalEvent[] {
  const todayStr = new Date().toISOString().split("T")[0];

  // Timeframe filter
  const byTime = events.filter((e) => {
    if (ctx.time.timeframe === "now" || ctx.time.timeframe === "tonight") {
      return e.date === todayStr;
    }
    // weekend: within 3 days
    return isWithinDays(e.date, 3);
  });

  // Category/mood filter
  const allowedCategories: EventCategory[] =
    answers.category && CATEGORY_LOCAL_CATEGORIES[answers.category]
      ? CATEGORY_LOCAL_CATEGORIES[answers.category]
      : mood
      ? MOOD_LOCAL_CATEGORIES[mood]
      : (Object.values(CATEGORY_LOCAL_CATEGORIES).flat() as EventCategory[]);

  return byTime.filter((e) => allowedCategories.includes(e.category));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function getCoords(): Promise<{ latitude: number; longitude: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === "granted") {
    const { coords } = await Location.getCurrentPositionAsync({});
    return { latitude: coords.latitude, longitude: coords.longitude };
  }
  // Fallback 1: ipapi.co
  try {
    const res = await fetch("https://ipapi.co/json/");
    const json = await res.json();
    if (json.latitude && json.longitude) {
      return { latitude: json.latitude, longitude: json.longitude };
    }
  } catch {}
  // Fallback 2: geolocation-db
  try {
    const res = await fetch("https://geolocation-db.com/json/");
    const json = await res.json();
    if (json.latitude && json.longitude) {
      return { latitude: json.latitude, longitude: json.longitude };
    }
  } catch {}
  throw new Error("Location access required. Please allow location permissions and try again.");
}

export async function getSuggestions(): Promise<SuggestionSet> {
  const { latitude, longitude } = await getCoords();

  const { mood, answers } = useStore.getState();
  const timeframe: Timeframe = (answers.timeframe as Timeframe) ?? "now";
  // "close" = 8 miles (~13 km) — tight Columbus city radius
  // "far"   = 30 miles (~48 km) — broader metro / willing to drive
  // low energy → always close regardless of distance answer
  const isLowEnergy = answers.energy === "low";
  const radiusKm = (answers.distance === "far" && !isLowEnergy) ? 48 : 13;

  const ctx = await buildContext(latitude, longitude, timeframe, radiusKm);

  // "home" mood → skip fetching places, just return movies/local events
  const isHomeMode = answers.category === "home";

  let keyword: string;
  if (answers.category && answers.category !== "random") {
    keyword = CATEGORY_KEYWORDS[answers.category] ?? answers.category;
  } else if (answers.category === "random") {
    keyword = CATEGORY_KEYWORDS.random;
  } else {
    keyword = mood ? MOOD_KEYWORDS[mood] : "cafe";
  }

  // Setting override: "indoor" moods skip outdoor keywords, "outdoor" skips bars/cafes
  if (answers.setting === "outdoor" && (keyword === "cafe" || keyword === "bar")) {
    keyword = "park";
  }
  if (answers.setting === "indoor" && keyword === "park") {
    keyword = "cafe";
  }

  if (ctx.weather.isRainy) {
    keyword =
      RAINY_OVERRIDES[keyword] ??
      RAINY_OVERRIDES[answers.category ?? ""] ??
      keyword;
  }

  const weatherTag = buildWeatherTag(ctx);
  const radiusM = radiusKm * 1000;

  // "home" mode skips place search entirely
  const [googlePlaces, yelpPlaces] = isHomeMode
    ? [[] as Place[], [] as Place[]]
    : await Promise.all([
        searchPlaces(keyword, latitude, longitude, radiusM).catch(() => [] as Place[]),
        searchYelp(keyword, latitude, longitude, radiusM).catch(() => [] as Place[]),
      ]);

  const seenNames = new Set<string>();
  const places: Place[] = [];
  for (const p of [...googlePlaces, ...yelpPlaces]) {
    const key = p.name.toLowerCase();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      places.push(p);
    }
  }

  // ── Events (Ticketmaster) ────────────────────────────────────────────────────
  const filteredEvents = mood
    ? filterEventsByMoodAndTime(ctx.events, mood, ctx)
    : ctx.events.slice(0, 3);

  const eventResults: EventResult[] = filteredEvents.slice(0, 3).map((e) => {
    const tags: string[] = [];
    const time = formatTime(e.time);
    if (time) tags.push(`${e.date} ${time}`);
    if (e.minPrice != null) tags.push(`From $${Math.round(e.minPrice)}`);
    if (e.genre) tags.push(e.genre);
    return { type: "event", event: e, contextTags: tags };
  });

  // ── Movies ───────────────────────────────────────────────────────────────────
  const movieResults: MovieResult[] =
    mood === "lazy" || mood === "surprise" || answers.category === "movies"
      ? ctx.showtimes.slice(0, 2).map((s) => ({
          type: "movie",
          showtime: s,
          contextTags: [
            s.theater,
            s.times.slice(0, 3).join(" · "),
            ...(s.rating ? [s.rating] : []),
          ],
        }))
      : [];

  // ── Local scraped events (Columbus sites, NPS, RecGov) ───────────────────────
  const filteredLocalEvents = filterLocalEvents(ctx.localEvents, mood, answers, ctx);
  const localEventResults: LocalEventResult[] = filteredLocalEvents.slice(0, 4).map((e) => {
    const tags: string[] = [];
    if (e.time) tags.push(e.time);
    if (e.price) tags.push(e.price);
    if (e.venue) tags.push(e.venue);
    return { type: "localEvent", localEvent: e, contextTags: tags };
  });

  // ── Places — only fill in if events are thin ─────────────────────────────────
  const eventCount = eventResults.length + localEventResults.length + movieResults.length;
  const placesToShow = eventCount >= 3 ? 1 : eventCount >= 1 ? 2 : 4;

  const placeResults: PlaceResult[] = places.slice(0, placesToShow).map((p) => ({
    type: "place",
    place: p,
    contextTags: [
      weatherTag,
      ...(ctx.weather.isRainy ? ["🌧 Indoors recommended"] : []),
    ],
  }));

  // ── Final order: events → movies → local → places ────────────────────────────
  return {
    results: [...eventResults, ...movieResults, ...localEventResults, ...placeResults],
    context: ctx,
  };
}
