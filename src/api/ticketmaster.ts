export interface Event {
  id: string;
  name: string;
  type: "music" | "sports" | "arts" | "comedy" | "other";
  venue: string;
  address: string;
  date: string;
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

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  if (date.toDateString() === now.toDateString()) return "Tonight";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
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

  return rawEvents.map((e: any): Event => {
    const segment = e.classifications?.[0]?.segment?.id ?? "";
    const type = TYPE_MAP[segment] ?? "other";
    const genre = e.classifications?.[0]?.genre?.name;
    const venue = e._embedded?.venues?.[0];
    const priceRange = e.priceRanges?.[0];
    const dateInfo = e.dates?.start;

    return {
      id: e.id,
      name: e.name,
      type,
      genre,
      venue: venue?.name ?? "Unknown Venue",
      address: venue?.address?.line1 ?? "",
      date: dateInfo?.localDate ? formatEventDate(dateInfo.localDate) : "TBD",
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
  });
}
