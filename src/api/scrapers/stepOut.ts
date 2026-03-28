import { parse } from "node-html-parser";
import { LocalEvent, EventCategory } from "./types";

const BASE = "https://stepoutcolumbus.com";
const EVENTS_URL = `${BASE}/things-to-do/`;
const SOURCE = "step-out-columbus";

// Divi/WordPress theme. Event posts use .et_pb_post or .et_pb_portfolio_item
// Event links match /event/ in the href

function guessCategory(title: string, cats: string): EventCategory {
  const t = (title + " " + cats).toLowerCase();
  if (t.includes("music") || t.includes("concert") || t.includes("live music")) return "music";
  if (t.includes("film") || t.includes("movie")) return "film";
  if (t.includes("art") || t.includes("gallery") || t.includes("theatre")) return "arts";
  if (t.includes("food") || t.includes("drink") || t.includes("restaurant")) return "food";
  if (t.includes("comedy")) return "comedy";
  if (t.includes("outdoor") || t.includes("hike") || t.includes("festival")) return "outdoor";
  return "community";
}

function extractDateFromUrl(url: string): string {
  // WordPress event URLs often contain /YYYY/MM/DD/ or event date in slug
  const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return new Date().toISOString().split("T")[0];
}

export async function scrapeStepOut(): Promise<LocalEvent[]> {
  const res = await fetch(EVENTS_URL);
  if (!res.ok) throw new Error(`StepOut fetch failed: ${res.status}`);
  const html = await res.text();
  const root = parse(html);
  const events: LocalEvent[] = [];

  const posts = root.querySelectorAll(
    ".et_pb_post, .et_pb_portfolio_item, article.post, article.type-post"
  );

  for (const post of posts) {
    const titleEl = post.querySelector("h2 a, h3 a, h4 a, .entry-title a");
    if (!titleEl) continue;

    const title = titleEl.text.trim();
    const href = titleEl.getAttribute("href") ?? EVENTS_URL;
    if (!title || !href.includes("stepout")) continue;

    const date = extractDateFromUrl(href);
    const description = post.querySelector(".entry-summary, .post-content, p")?.text?.trim();
    const imgEl = post.querySelector("img");
    const image =
      imgEl?.getAttribute("src") ??
      imgEl?.getAttribute("data-lazy-src") ??
      imgEl?.getAttribute("data-src");

    const catEl = post.querySelector(".post-categories, .entry-categories");
    const cats = catEl?.text?.trim() ?? "";

    events.push({
      id: `${SOURCE}-${date}-${title}`.replace(/\s+/g, "-").toLowerCase(),
      title,
      venue: "Columbus",
      date,
      description,
      url: href,
      image: image ?? undefined,
      category: guessCategory(title, cats),
      source: SOURCE,
    });
  }

  return events;
}
