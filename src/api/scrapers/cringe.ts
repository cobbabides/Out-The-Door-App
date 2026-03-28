import { parse } from "node-html-parser";
import { LocalEvent, EventCategory } from "./types";

const URL = "https://www.cringe.com";
const SOURCE = "cringe";

// Cringe.com is server-rendered plain text organized like:
//   <h3>MARCH 23, 2026</h3>
//   <strong><a href="...">Venue Name</a></strong> - phone
//   Mon 23: Event Title (ages 21+) 10pm

function parseDate(rawDate: string): string | null {
  try {
    const d = new Date(`${rawDate} ${new Date().getFullYear()}`);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function parseTime(text: string): string | undefined {
  const match = text.match(/(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
  if (!match) return undefined;
  const [, time, ampm] = match;
  const [h, m = "00"] = time.split(":");
  const hour = parseInt(h);
  const display = `${hour}:${m.padStart(2, "0")} ${ampm.toUpperCase()}`;
  return display;
}

function guessCategory(title: string): EventCategory {
  const t = title.toLowerCase();
  if (t.includes("karaoke") || t.includes("trivia") || t.includes("bingo")) return "other";
  if (t.includes("comedy") || t.includes("stand-up")) return "comedy";
  if (t.includes("live music") || t.includes("band") || t.includes("dj")) return "music";
  if (t.includes("open mic") || t.includes("open-mic")) return "music";
  return "music"; // cringe is primarily a music/bar events site
}

export async function scrapeCringe(): Promise<LocalEvent[]> {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Cringe fetch failed: ${res.status}`);
  const html = await res.text();
  const root = parse(html);
  const events: LocalEvent[] = [];

  // Date sections — h2 or h3 containing month/date strings
  const sections = root.querySelectorAll("h2, h3");

  let currentDate = new Date().toISOString().split("T")[0];
  let currentVenue = "";
  let currentVenueUrl = "";

  for (const section of sections) {
    const text = section.text.trim();
    // Try to parse as a date header (e.g. "MARCH 23, 2026" or "MONDAY, MARCH 23")
    const dateMatch = text.match(
      /([A-Z]+)\s+(\d{1,2}),?\s*(\d{4})?/i
    );
    if (dateMatch) {
      const parsed = parseDate(
        dateMatch[3]
          ? `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`
          : `${dateMatch[1]} ${dateMatch[2]}`
      );
      if (parsed) currentDate = parsed;

      // Venues and events follow as siblings until the next date section
      let sibling = section.nextElementSibling;
      while (sibling && !["H2", "H3"].includes(sibling.tagName)) {
        const sibText = sibling.text.trim();

        // Venue line — has a link inside strong/b
        const venueLink = sibling.querySelector("a");
        if (sibling.querySelector("strong, b") && venueLink) {
          currentVenue = venueLink.text.trim();
          currentVenueUrl = venueLink.getAttribute("href") ?? "";
          sibling = sibling.nextElementSibling;
          continue;
        }

        // Event lines — typically "Day DD: Event Title (restriction) time"
        const eventMatch = sibText.match(
          /^(?:\w{3}\s+\d{1,2}:\s*)?(.+?)(?:\s+\(([^)]+)\))?\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))?$/i
        );
        if (eventMatch && currentVenue && sibText.length > 3) {
          const title = eventMatch[1].trim();
          const time = parseTime(sibText);
          if (title && title.length > 2) {
            events.push({
              id: `${SOURCE}-${currentDate}-${currentVenue}-${title}`.replace(/\s+/g, "-").toLowerCase(),
              title,
              venue: currentVenue,
              date: currentDate,
              time,
              url: currentVenueUrl || URL,
              category: guessCategory(title),
              source: SOURCE,
            });
          }
        }

        sibling = sibling.nextElementSibling;
      }
    }
  }

  return events;
}
