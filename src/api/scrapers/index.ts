import { LocalEvent } from "./types";
import { scrapeCringe } from "./cringe";
import { scrapeExperienceColumbus } from "./experienceColumbus";
import { scrapeColumbusOnTheCheap } from "./columbusOnTheCheap";
import { scrapeGateway } from "./gateway";
import { scrapeStepOut } from "./stepOut";
import { scrape614Now } from "./now614";
import { scrapeCapa } from "./capa";
import { scrapeAllTheaters } from "./theaters";

export type { LocalEvent, EventCategory } from "./types";

// Run all scrapers in parallel, each failing gracefully
export async function scrapeAllLocalEvents(): Promise<LocalEvent[]> {
  const results = await Promise.allSettled([
    scrapeCringe(),
    scrapeExperienceColumbus(),
    scrapeColumbusOnTheCheap(),
    scrapeGateway(),
    scrapeStepOut(),
    scrape614Now(),
    scrapeCapa(),
    scrapeAllTheaters(),
  ]);

  const events: LocalEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      events.push(...result.value);
    }
    // Silently skip failed scrapers — one broken site doesn't kill the rest
  }

  // Deduplicate by title + date + venue
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.title.toLowerCase()}-${e.date}-${e.venue.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Convenience: run only the fast/reliable ones for time-sensitive requests
export async function scrapeQuickLocalEvents(): Promise<LocalEvent[]> {
  const results = await Promise.allSettled([
    scrapeCringe(),
    scrapeExperienceColumbus(),
    scrapeColumbusOnTheCheap(),
  ]);

  return results
    .filter((r): r is PromiseFulfilledResult<LocalEvent[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}
