export interface Event {
  id: string;
  name: string;
  type: "music" | "sports" | "arts" | "comedy" | "other";
  venue: string;
  address: string;
  date: string;    // human-readable display label
  rawDate: string; // YYYY-MM-DD local date (reliable for sorting/grouping)
  time: string;
  url: string;
  minPrice?: number;
  maxPrice?: number;
  image?: string;
  genre?: string;
  distanceMi?: number;
}

const TYPE_MAP: Record<string, Event["type"]> = {
  "KZFzniwnSyZfZ7v7nJ": "music",
  "KZFzniwnSyZfZ7v7nE": "sports",
  "KZFzniwnSyZfZ7v7na": "arts",
  "KZFzniwnSyZfZ7v7nn": "comedy",
};

/**
 * Parse a YYYY-MM-DD string as LOCAL midnight (not UTC).
 * `new Date("2026-03-29")` is UTC midnight, which in e.g. EDT (UTC-4)
 * becomes 2026-03-28 at 8 PM — one day off. Splitting and using the
 * Date(y, m, d) constructor avoids this.
 */
function localDateFromISO(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatEventDate(localDate: string): string {
  const date = localDateFromISO(localDate);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (date.getTime() === today.getTime()) return "Tonight";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export async function getNearbyEvents(
  lat: number,
  lon: number,
  radiusMi = 10,
  limit = 10
): Promise<Event[]> {
  const key = process.env.EXPO_PUBLIC_TICKETMASTER_KEY;
  const url =
    `https://app.ticketmaster.com/discovery/v2/events.json` +
    `?apikey=${key}` +
    `&latlong=${lat},${lon}` +
    `&radius=${radiusMi}` +
    `&unit=miles` +
    `&size=${limit}` +
    `&sort=date,asc` +
    `&startDateTime=${new Date().toISOString().split(".")[0]}Z`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ticketmaster error: ${res.status}`);
  const json = await res.json();

  const rawEvents = json._embedded?.events ?? [];

  // Ticketmaster uses DMA (Designated Market Area) routing and often returns
  // results well outside the requested radius. Filter client-side when the
  // venue distance field is present.
  return rawEvents.map((e: any): Event => {
    const segment = e.classifications?.[0]?.segment?.id ?? "";
    const type = TYPE_MAP[segment] ?? "other";
    const genre = e.classifications?.[0]?.genre?.name;
    const venue = e._embedded?.venues?.[0];
    const priceRange = e.priceRanges?.[0];
    const dateInfo = e.dates?.start;
    const localDate: string = dateInfo?.localDate ?? "";

    return {
      id: e.id,
      name: e.name,
      type,
      genre,
      venue: venue?.name ?? "Unknown Venue",
      address: venue?.address?.line1 ?? "",
      date: localDate ? formatEventDate(localDate) : "TBD",
      rawDate: localDate || new Date().toISOString().split("T")[0],
      time: dateInfo?.localTime
        ? new Date(`1970-01-01T${dateInfo.localTime}`).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })
        : "TBD",
      url: e.url,
      minPrice: priceRange?.min,
      maxPrice: priceRange?.max,
      image: e.images?.find(
        (img: any) => img.ratio === "16_9" && img.width > 500
      )?.url,
      distanceMi: venue?.distance ? parseFloat(venue.distance) : undefined,
    };
  }).filter((e: Event) =>
    // Drop anything the API reports as clearly outside the requested radius.
    // Use 1.5× tolerance to account for rounding; keep events with no distance.
    e.distanceMi == null || e.distanceMi <= radiusMi * 1.5
  );
}
