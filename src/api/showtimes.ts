import { scrapeAllTheaters, TheaterShowtime } from "./scrapers/theaters";

export interface Showtime {
  movieTitle: string;
  rating: string;
  runtime: string;
  genre: string;
  theater: string;
  address?: string;
  times: string[];
  distanceMi: number;
  posterUrl?: string;
  ticketUrl?: string;
}

// Group individual TheaterShowtime entries (one per showing) into
// Showtime objects (one per movie+theater, with all times grouped).
function groupShowtimes(raw: TheaterShowtime[]): Showtime[] {
  const groups = new Map<string, TheaterShowtime[]>();

  for (const s of raw) {
    const key = `${s.title}|${s.venue}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  return Array.from(groups.values()).map((group): Showtime => {
    const first = group[0];
    const times = group
      .map((s) => s.time)
      .filter((t): t is string => Boolean(t))
      .sort();

    return {
      movieTitle: first.title,
      rating: first.rating ?? "NR",
      runtime: first.runtime ?? "",
      genre: "Film",
      theater: first.venue,
      address: first.address,
      times,
      distanceMi: 0,
      posterUrl: first.posterUrl,
      ticketUrl: first.checkoutUrl,
    };
  });
}

export async function getShowtimes(
  _lat: number,
  _lon: number,
  _radiusMi = 10
): Promise<Showtime[]> {
  const today = new Date().toISOString().split("T")[0];

  const raw = await scrapeAllTheaters();

  // Only return showtimes for today or future dates
  const upcoming = raw.filter((s) => !s.date || s.date >= today);

  return groupShowtimes(upcoming);
}
