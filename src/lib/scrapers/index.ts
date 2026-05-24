import { PsnScraper } from "./psn";
import type { StoreScraper } from "./types";

export type { ScrapedGame, StoreScraper } from "./types";

const scrapers: Record<string, () => StoreScraper> = {
  psn: () => new PsnScraper(),
};

export function getScraper(store: string): StoreScraper {
  const factory = scrapers[store];
  if (!factory) throw new Error(`Unknown store: ${store}`);
  return factory();
}

export function getAvailableStores(): string[] {
  return Object.keys(scrapers);
}
