import { LocalEvent, EventCategory } from "./types";

const BASE = "https://www.experiencecolumbus.com";
const ENDPOINT = `${BASE}/includes/rest_v2/plugins_events_events_by_date/find/`;
const SOURCE = "experience-columbus";

function guessCategory(categories: string[]): EventCategory {
  const cats = categories.map((c) => c.toLowerCase()).join(" ");
  if (cats.includes("music") || cats.includes("concert")) return "music";
  if (cats.includes("film") || cats.includes("movie")) return "film";
  if (cats.includes("art") || cats.includes("theater") || cats.includes("theatre")) return "arts";
  if (cats.includes("food") || cats.includes("drink") || cats.includes("dining")) return "food";
  if (cats.includes("comedy")) return "comedy";
  if (cats.includes("sport")) return "sports";
  if (cats.includes("outdoor") || cats.includes("festival")) return "outdoor";
  return "community";
}

export async function scrapeExperienceColumbus(
  daysAhead = 7
): Promise<LocalEvent[]> {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  // Try common query param patterns for this REST endpoint
  const url = new URL(ENDPOINT);
  url.searchParams.set("start_date", fmt(startDate));
  url.searchParams.set("end_date", fmt(endDate));
  url.searchParams.set("city", "Columbus");
  url.searchParams.set("limit", "50");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ExperienceColumbus fetch failed: ${res.status}`);

  const json = await res.json();
  const items: any[] = json.data ?? json.results ?? json ?? [];

  return items.map((item: any): LocalEvent => ({
    id: `${SOURCE}-${item.recid ?? item.id}`,
    title: item.title ?? item.name ?? "Untitled",
    venue: item.venue ?? item.location ?? "Columbus",
    address: item.address,
    date: item.date ?? item.start_date ?? fmt(startDate),
    time: item.time ?? item.start_time,
    description: item.description,
    url: item.url ? `${BASE}${item.url}` : BASE,
    image: item.media_raw?.url ?? item.image,
    category: guessCategory(item.categories ?? []),
    source: SOURCE,
  }));
}
