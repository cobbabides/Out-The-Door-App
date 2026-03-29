import { getCurrentWeather, WeatherContext } from "../api/openWeather";
import { getNearbyEvents, Event } from "../api/ticketmaster";
import { getShowtimes, Showtime } from "../api/showtimes";
import { scrapeAllLocalEvents, LocalEvent } from "../api/scrapers";
import { getNearbyParks } from "../api/nps";
import { getNearbyFacilities } from "../api/recgov";

export type Timeframe = "now" | "tonight" | "weekend";

export interface TimeContext {
  hour: number;
  isWeekend: boolean;
  isMorning: boolean;    // before 11
  isAfternoon: boolean;  // 11–17
  isEvening: boolean;    // 17–21
  isLateNight: boolean;  // after 21
  label: string;         // e.g. "Friday evening"
  timeframe: Timeframe;
}

export interface AppContext {
  coords: { latitude: number; longitude: number };
  weather: WeatherContext;
  time: TimeContext;
  events: Event[];
  showtimes: Showtime[];
  localEvents: LocalEvent[];
}

function buildTimeContext(timeframe: Timeframe): TimeContext {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const dayName = now.toLocaleDateString([], { weekday: "long" });

  const isMorning = hour < 11;
  const isAfternoon = hour >= 11 && hour < 17;
  const isEvening = hour >= 17 && hour < 21;
  const isLateNight = hour >= 21;

  const partOfDay = isMorning
    ? "morning"
    : isAfternoon
    ? "afternoon"
    : isEvening
    ? "evening"
    : "night";

  return {
    hour,
    isWeekend,
    isMorning,
    isAfternoon,
    isEvening,
    isLateNight,
    label: `${dayName} ${partOfDay}`,
    timeframe,
  };
}

export async function buildContext(
  latitude: number,
  longitude: number,
  timeframe: Timeframe,
  radiusKm: number
): Promise<AppContext> {
  const time = buildTimeContext(timeframe);
  const radiusMi = Math.round(radiusKm * 0.621);

  // Wrap scrapers in a 6s timeout so slow/dead sites don't stall the app
  const withTimeout = <T>(p: Promise<T>, fallback: T, ms = 6000): Promise<T> =>
    Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);

  const [weather, events, showtimes, localEvents] = await Promise.all([
    getCurrentWeather(latitude, longitude).catch((): WeatherContext => ({
      temp: 65,
      description: "unknown",
      isRainy: false,
      isCold: false,
      isHot: false,
      sunsetTime: "8:00 PM",
      icon: "🌤️",
    })),
    // Ask for at least 30 mi so we get enough candidates; client-side filtering
    // in ticketmaster.ts will trim anything beyond the true requested radius.
    getNearbyEvents(latitude, longitude, Math.max(radiusMi, 30)).catch((): Event[] => []),
    getShowtimes(latitude, longitude, radiusMi).catch((): Showtime[] => []),
    withTimeout(
      Promise.all([
        scrapeAllLocalEvents().catch((): LocalEvent[] => []),
        getNearbyParks(latitude, longitude).catch((): LocalEvent[] => []),
        getNearbyFacilities(latitude, longitude).catch((): LocalEvent[] => []),
      ]).then(([scraped, parks, facilities]) => [...scraped, ...parks, ...facilities]),
      []
    ),
  ]);

  return { coords: { latitude, longitude }, weather, time, events, showtimes, localEvents };
}
