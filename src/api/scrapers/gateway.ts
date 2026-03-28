import { parse } from "node-html-parser";
import { LocalEvent } from "./types";

const BASE = "https://www.gatewayfilmcenter.org";
const URL = `${BASE}/movies/now-playing`;
const SOURCE = "gateway-film-center";

// Gateway is hybrid server-rendered.
// .showtimes-container > .showtime cards
// Each .showtime has h3/h4 for title, ol li for showtimes, data-date attr

export async function scrapeGateway(): Promise<LocalEvent[]> {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Gateway fetch failed: ${res.status}`);
  const html = await res.text();
  const root = parse(html);
  const events: LocalEvent[] = [];

  const today = new Date().toISOString().split("T")[0];

  // Try the .showtimes-container structure first
  const container = root.querySelector(".showtimes-container");
  const cards = container
    ? container.querySelectorAll(".showtime")
    : root.querySelectorAll(".showtime, [data-type='now-playing'] .film");

  for (const card of cards) {
    const titleEl = card.querySelector("h3, h4, h2, .film-title");
    if (!titleEl) continue;
    const title = titleEl.text.trim();
    if (!title) continue;

    const link = card.querySelector("a");
    const href = link ? `${BASE}${link.getAttribute("href") ?? ""}` : BASE;

    // Grab all showtimes from list items or buttons
    const timeEls = card.querySelectorAll(
      "ol li, .showtime-button, button[data-time], a[data-time]"
    );
    const times = timeEls
      .map((el) => el.text.trim())
      .filter((t) => /\d/.test(t));

    const description = card.querySelector("p, .description")?.text?.trim();
    const imgEl = card.querySelector("img");
    const image = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-lazy-src");

    if (times.length === 0) {
      // Still add the film with no specific showtime
      events.push({
        id: `${SOURCE}-${today}-${title}`.replace(/\s+/g, "-").toLowerCase(),
        title,
        venue: "Gateway Film Center",
        address: "1550 N High St, Columbus, OH 43201",
        date: today,
        description,
        url: href,
        image: image ?? undefined,
        category: "film",
        source: SOURCE,
      });
    } else {
      for (const time of times) {
        events.push({
          id: `${SOURCE}-${today}-${title}-${time}`.replace(/\s+/g, "-").toLowerCase(),
          title,
          venue: "Gateway Film Center",
          address: "1550 N High St, Columbus, OH 43201",
          date: today,
          time,
          description,
          url: href,
          image: image ?? undefined,
          category: "film",
          source: SOURCE,
        });
      }
    }
  }

  return events;
}
