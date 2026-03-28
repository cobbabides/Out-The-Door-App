import { parse } from "node-html-parser";
import { LocalEvent, EventCategory } from "./types";

const URL = "https://www.columbusonthecheap.com/events/";
const SOURCE = "columbus-on-the-cheap";

// Server-rendered. Events grouped under date sections like "Today: Friday, March 27"
// Each event: <h3><a href="...">Title</a></h3>
//             <strong>Time</strong> | Price | Location

function parseDateHeader(text: string): string | null {
  // "Friday, March 27, 2026" or "Today: Friday, March 27"
  const match = text.match(/([A-Z][a-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?/);
  if (!match) return null;
  const year = match[3] ?? new Date().getFullYear().toString();
  try {
    const d = new Date(`${match[1]} ${match[2]} ${year}`);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function parsePrice(text: string): string | undefined {
  if (text.toLowerCase().includes("free")) return "Free";
  const match = text.match(/\$[\d.]+/);
  return match ? match[0] : undefined;
}

function guessCategory(title: string, description: string): EventCategory {
  const t = (title + " " + description).toLowerCase();
  if (t.includes("music") || t.includes("concert") || t.includes("band")) return "music";
  if (t.includes("film") || t.includes("movie") || t.includes("cinema")) return "film";
  if (t.includes("art") || t.includes("gallery") || t.includes("museum")) return "arts";
  if (t.includes("food") || t.includes("tasting") || t.includes("market")) return "food";
  if (t.includes("comedy")) return "comedy";
  if (t.includes("hike") || t.includes("trail") || t.includes("outdoor")) return "outdoor";
  return "community";
}

export async function scrapeColumbusOnTheCheap(): Promise<LocalEvent[]> {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`ColumbusOnTheCheap fetch failed: ${res.status}`);
  const html = await res.text();
  const root = parse(html);
  const events: LocalEvent[] = [];

  let currentDate = new Date().toISOString().split("T")[0];

  // Date headers are h2/h3/h4 containing day names + dates
  const allElements = root.querySelectorAll("h2, h3, h4, article, .event");

  for (const el of allElements) {
    const text = el.text.trim();

    // Check if it's a date header
    const parsed = parseDateHeader(text);
    if (parsed && (text.includes("day") || text.includes("March") || text.includes("April") || text.includes("May"))) {
      currentDate = parsed;
      continue;
    }

    // Check if it's an event entry (has a link and is not a nav element)
    const link = el.querySelector("a");
    if (!link) continue;

    const title = link.text.trim();
    if (!title || title.length < 3) continue;

    const href = link.getAttribute("href") ?? URL;
    const description = el.querySelector("p")?.text?.trim();

    // Look for time and price in sibling text
    const fullText = el.text;
    const timeMatch = fullText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
    const time = timeMatch
      ? timeMatch[1].replace(/(\d+:\d+)\s*(am|pm)/i, (_, t, ap) => `${t} ${ap.toUpperCase()}`)
      : undefined;
    const price = parsePrice(fullText);

    events.push({
      id: `${SOURCE}-${currentDate}-${title}`.replace(/\s+/g, "-").toLowerCase(),
      title,
      venue: "Columbus",
      date: currentDate,
      time,
      description,
      url: href,
      price,
      category: guessCategory(title, description ?? ""),
      source: SOURCE,
    });
  }

  return events;
}
