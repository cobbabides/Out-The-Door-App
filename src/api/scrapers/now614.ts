import { parse } from "node-html-parser";
import { LocalEvent, EventCategory } from "./types";

const BASE = "https://www.614now.com";
const EVENTS_URL = `${BASE}/things-to-do/`;
const SOURCE = "614now";

// Blog-post style events. Posts have .post-title, .post-date, .thb-post-bottom

function guessCategory(title: string, cats: string): EventCategory {
  const t = (title + " " + cats).toLowerCase();
  if (t.includes("music") || t.includes("concert") || t.includes("festival")) return "music";
  if (t.includes("film") || t.includes("movie") || t.includes("cinema")) return "film";
  if (t.includes("art") || t.includes("gallery") || t.includes("museum")) return "arts";
  if (t.includes("food") || t.includes("restaurant") || t.includes("dining")) return "food";
  if (t.includes("comedy") || t.includes("stand-up")) return "comedy";
  if (t.includes("hike") || t.includes("outdoor") || t.includes("nature")) return "outdoor";
  return "community";
}

function parseDateText(text: string): string {
  try {
    const d = new Date(text);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return new Date().toISOString().split("T")[0];
}

export async function scrape614Now(): Promise<LocalEvent[]> {
  const res = await fetch(EVENTS_URL);
  if (!res.ok) throw new Error(`614Now fetch failed: ${res.status}`);
  const html = await res.text();
  const root = parse(html);
  const events: LocalEvent[] = [];

  const posts = root.querySelectorAll("article, .post, .type-post");

  for (const post of posts) {
    const titleEl = post.querySelector(
      ".post-title a, h2 a, h3 a, h4 a, .entry-title a"
    );
    if (!titleEl) continue;

    const title = titleEl.text.trim();
    const href = titleEl.getAttribute("href") ?? EVENTS_URL;
    if (!title) continue;

    const dateEl = post.querySelector(
      ".post-date, time, .entry-date, .thb-post-bottom time"
    );
    const dateText = dateEl?.getAttribute("datetime") ?? dateEl?.text ?? "";
    const date = parseDateText(dateText);

    const description = post.querySelector(".post-excerpt, .entry-summary, p")?.text?.trim();

    const imgEl = post.querySelector("img");
    const image =
      imgEl?.getAttribute("src") ??
      imgEl?.getAttribute("data-lazy-src") ??
      imgEl?.getAttribute("data-src");

    const catEl = post.querySelector(".post-category, .entry-categories, .cat-links");
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
