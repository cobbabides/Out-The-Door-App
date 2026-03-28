import { parse } from "node-html-parser";
import { LocalEvent } from "./types";

export interface TheaterShowtime extends LocalEvent {
  rating?: string;
  runtime?: string;
  posterUrl?: string;
  checkoutUrl?: string;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function extractJsonLd(html: string, type: string): any | null {
  const root = parse(html);
  const scripts = root.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.text);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === type) return item;
      }
    } catch {}
  }
  return null;
}

// Parse "March 26, 9:15 pm" → { date: "2026-03-26", time: "9:15 PM" }
function parseShowtimeText(text: string): { date: string; time: string } | null {
  const match = text.match(
    /([A-Za-z]+\s+\d{1,2}),?\s+(\d{1,2}:\d{2}\s*(?:am|pm))/i
  );
  if (!match) return null;
  try {
    const year = new Date().getFullYear();
    const d = new Date(`${match[1]} ${year}`);
    if (isNaN(d.getTime())) return null;
    const date = d.toISOString().split("T")[0];
    const time = match[2].replace(
      /(\d+:\d+)\s*(am|pm)/i,
      (_, t, ap) => `${t} ${ap.toUpperCase()}`
    );
    return { date, time };
  } catch {
    return null;
  }
}

// Parse ISO 8601 duration "PT1H40M" → "1h 40m"
function parseDuration(iso: string): string | undefined {
  const match = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return undefined;
  const h = match[1] ? `${match[1]}h` : "";
  const m = match[2] ? ` ${match[2]}m` : "";
  return `${h}${m}`.trim();
}

// ─── Studio 35 ────────────────────────────────────────────────────────────────
// 3055 Indianola Ave, Columbus, OH 43202

async function getMovieSlugs(baseUrl: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/sitemap.xml`);
  if (!res.ok) return [];
  const xml = await res.text();
  const root = parse(xml);
  return root
    .querySelectorAll("url loc")
    .map((el) => el.text.trim())
    .filter((url) => url.includes("/movie/"));
}

async function scrapeIndyCinemaMoviePage(
  url: string,
  venue: string,
  address: string,
  source: string
): Promise<TheaterShowtime[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const html = await res.text();
  const root = parse(html);

  const movieData = extractJsonLd(html, "Movie");
  if (!movieData) return [];

  const title: string = movieData.name ?? "Unknown";
  const rating: string | undefined = movieData.contentRating;
  const runtime = parseDuration(movieData.duration ?? "");
  const genre: string | undefined = Array.isArray(movieData.genre)
    ? movieData.genre[0]
    : movieData.genre;
  const posterUrl: string | undefined =
    typeof movieData.image === "string"
      ? movieData.image
      : movieData.image?.url;

  // Showtime links: text "March 26, 9:15 pm", href "/checkout/showing/slug/ID"
  const showtimeLinks = root.querySelectorAll(
    'a[href*="/checkout/showing/"], a[href*="/tickets/"]'
  );

  const events: TheaterShowtime[] = [];

  for (const link of showtimeLinks) {
    const text = link.text.trim();
    const parsed = parseShowtimeText(text);
    if (!parsed) continue;

    const checkoutUrl = link.getAttribute("href") ?? "";
    const fullCheckout = checkoutUrl.startsWith("http")
      ? checkoutUrl
      : `${new URL(url).origin}${checkoutUrl}`;

    events.push({
      id: `${source}-${parsed.date}-${title}-${parsed.time}`
        .replace(/\s+/g, "-")
        .toLowerCase(),
      title,
      venue,
      address,
      date: parsed.date,
      time: parsed.time,
      url,
      category: "film",
      rating,
      runtime,
      posterUrl,
      checkoutUrl: fullCheckout,
      source,
    });
  }

  // If no showtimes found (special event format), try date-only links
  if (events.length === 0) {
    const dateLinks = root.querySelectorAll('a[href*="/checkout/"]');
    for (const link of dateLinks) {
      const text = link.text.trim();
      if (!text) continue;
      const parsed = parseShowtimeText(text);
      if (!parsed) continue;
      events.push({
        id: `${source}-${parsed.date}-${title}-${parsed.time}`
          .replace(/\s+/g, "-")
          .toLowerCase(),
        title,
        venue,
        address,
        date: parsed.date,
        time: parsed.time,
        url,
        category: "film",
        rating,
        runtime,
        posterUrl,
        source,
      });
    }
  }

  return events;
}

export async function scrapeStudio35(): Promise<TheaterShowtime[]> {
  const BASE = "https://www.studio35.com";
  const slugs = await getMovieSlugs(BASE);
  const results = await Promise.all(
    slugs.map((url) =>
      scrapeIndyCinemaMoviePage(
        url,
        "Studio 35 Cinema",
        "3055 Indianola Ave, Columbus, OH 43202",
        "studio35"
      ).catch(() => [] as TheaterShowtime[])
    )
  );
  return results.flat();
}

// ─── Grandview Theater ────────────────────────────────────────────────────────
// 1247 Grandview Ave, Grandview Heights, OH 43212

export async function scrapeGrandview(): Promise<TheaterShowtime[]> {
  const BASE = "https://www.grandviewtheater.com";
  const slugs = await getMovieSlugs(BASE);
  const results = await Promise.all(
    slugs.map((url) =>
      scrapeIndyCinemaMoviePage(
        url,
        "Grandview Theater",
        "1247 Grandview Ave, Grandview Heights, OH 43212",
        "grandview"
      ).catch(() => [] as TheaterShowtime[])
    )
  );
  return results.flat();
}

// ─── Phoenix Theatres (Lennox) ────────────────────────────────────────────────
// Fully client-side rendered — requires browser DevTools to find API.
//
// To wire this up:
//   1. Open phoenixtheatres.com in Chrome
//   2. DevTools → Network → XHR/Fetch → select your theater location
//   3. Look for a JSON request containing movie titles + showtimes
//   4. Copy the URL + any required headers (auth token, theater ID) here
//
// The platform is WebediMovies (cms-assets.webediamovies.pro).
// Their API likely requires a theater-specific token obtained after location selection.

export async function scrapePhoenix(): Promise<TheaterShowtime[]> {
  // TODO: Fill in once API endpoint is found via browser network inspection
  return [];
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

export async function scrapeAllTheaters(): Promise<TheaterShowtime[]> {
  const [studio35, grandview, phoenix] = await Promise.all([
    scrapeStudio35().catch(() => [] as TheaterShowtime[]),
    scrapeGrandview().catch(() => [] as TheaterShowtime[]),
    scrapePhoenix().catch(() => [] as TheaterShowtime[]),
  ]);
  return [...studio35, ...grandview, ...phoenix];
}
