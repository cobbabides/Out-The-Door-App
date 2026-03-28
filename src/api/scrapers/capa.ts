import { parse } from "node-html-parser";
import { LocalEvent, EventCategory } from "./types";

const BASE = "https://www.capa.com";
const URL = `${BASE}/event-calendar/`;
const SOURCE = "capa";

// Elementor-based. Event cards have thumbnail, title (h3/h4), date range, venue label.
// Ticket links go to tickets.capa.com

const CAPA_VENUES: Record<string, string> = {
  ohio: "Ohio Theatre, 39 E State St, Columbus, OH",
  palace: "Palace Theatre, 34 W Broad St, Columbus, OH",
  southern: "Southern Theatre, 21 E Main St, Columbus, OH",
  riffe: "Riffe Center Theatre, 77 S High St, Columbus, OH",
};

function guessVenue(text: string): string {
  const t = text.toLowerCase();
  for (const [key, val] of Object.entries(CAPA_VENUES)) {
    if (t.includes(key)) return val;
  }
  return "CAPA Venue, Columbus, OH";
}

function parseDateRange(text: string): string {
  // "April 7–12" or "April 7, 2026" or "Apr 7"
  const match = text.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return new Date().toISOString().split("T")[0];
  try {
    const year = new Date().getFullYear();
    const d = new Date(`${match[1]} ${match[2]} ${year}`);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return new Date().toISOString().split("T")[0];
}

function guessCategory(title: string): EventCategory {
  const t = title.toLowerCase();
  if (t.includes("ballet") || t.includes("dance")) return "arts";
  if (t.includes("symphony") || t.includes("orchestra") || t.includes("opera")) return "music";
  if (t.includes("broadway") || t.includes("musical") || t.includes("theatre")) return "arts";
  if (t.includes("comedy")) return "comedy";
  if (t.includes("film") || t.includes("movie")) return "film";
  return "arts"; // CAPA is primarily a performing arts venue
}

export async function scrapeCapa(): Promise<LocalEvent[]> {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`CAPA fetch failed: ${res.status}`);
  const html = await res.text();
  const root = parse(html);
  const events: LocalEvent[] = [];

  // Look for event cards — Elementor uses .elementor-post, .elementor-widget-loop-item
  // or production-specific containers
  const cards = root.querySelectorAll(
    ".elementor-post, .production-card, .event-card, " +
    ".elementor-widget-loop-item, article, .productions .item"
  );

  for (const card of cards) {
    const titleEl = card.querySelector("h2, h3, h4, .event-title, .production-title");
    if (!titleEl) continue;
    const title = titleEl.text.trim();
    if (!title || title.length < 3) continue;

    const link = card.querySelector("a");
    const href = link?.getAttribute("href") ?? URL;
    const fullHref = href.startsWith("http") ? href : `${BASE}${href}`;

    const dateEl = card.querySelector(".event-date, .date, time, .production-dates");
    const dateText = dateEl?.text?.trim() ?? "";
    const date = parseDateRange(dateText);

    const imgEl = card.querySelector("img");
    const image =
      imgEl?.getAttribute("src") ??
      imgEl?.getAttribute("data-lazy-src") ??
      imgEl?.getAttribute("data-src");

    const venueEl = card.querySelector(".venue, .location, .production-venue");
    const venueText = venueEl?.text?.trim() ?? card.text;

    events.push({
      id: `${SOURCE}-${date}-${title}`.replace(/\s+/g, "-").toLowerCase(),
      title,
      venue: guessVenue(venueText),
      date,
      url: fullHref,
      image: image ?? undefined,
      category: guessCategory(title),
      source: SOURCE,
    });
  }

  return events;
}
