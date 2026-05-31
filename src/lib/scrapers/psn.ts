import type { ScrapedGame, StoreScraper } from "./types";

const BASE_URL = "https://store.playstation.com/store/api/chihiro/00_09_000";
const COUNTRY = "in";
const LANGUAGE = "en";
const AGE = 999;
const CONTAINER = "STORE-MSF75508-FULLGAMES";
const PAGE_SIZE = 100;

interface PsnReward {
  price: number;
  display_price: string;
  discount: number;
  isPlus?: boolean;
}

interface PsnSku {
  price?: number;
  display_price?: string;
  rewards?: PsnReward[];
}

interface PsnImage {
  type: number;
  url: string;
}

interface PsnGame {
  id: string;
  name: string;
  default_sku?: PsnSku;
  images?: PsnImage[];
  playable_platform?: string[];
  top_category?: string;
  game_contentType?: string;
  url?: string;
}

interface PsnResponse {
  total_results: number;
  size: number;
  start: number;
  links?: PsnGame[];
}

async function fetchPage(start: number): Promise<PsnResponse | null> {
  const url =
    `${BASE_URL}/container/${COUNTRY}/${LANGUAGE}/${AGE}/${CONTAINER}` +
    `?size=${PAGE_SIZE}&start=${start}&gameContentType=games`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error(`PS Store API ${res.status} at start=${start}`);
      return null;
    }

    return (await res.json()) as PsnResponse;
  } catch (err) {
    console.error(`PS Store fetch failed at start=${start}:`, err);
    return null;
  }
}

function parseGame(game: PsnGame): ScrapedGame {
  const sku = game.default_sku;
  const basePrice = sku?.price ?? null;

  const nonPlusReward = sku?.rewards?.find((r) => !r.isPlus);
  const isOnSale = nonPlusReward !== undefined && basePrice !== null;
  const currentPrice = isOnSale ? nonPlusReward.price : basePrice;
  const discountPercent = isOnSale ? nonPlusReward.discount : null;

  // image type 1 = boxart/tile, fallback to any available
  const image =
    game.images?.find((i) => i.type === 1) ??
    game.images?.find((i) => i.type === 10) ??
    game.images?.[0];

  const isPS5 =
    game.playable_platform?.some((p) =>
      p.toUpperCase().includes("PS5")
    ) ?? false;

  return {
    storeId: game.id,
    title: game.name,
    currentPrice,
    originalPrice: basePrice,
    discountPercent,
    imageUrl: image?.url ?? null,
    platform: isPS5 ? "PS5" : "PS4",
    category: game.top_category ?? game.game_contentType ?? null,
    url: `https://store.playstation.com/en-in/product/${game.id}`,
    isOnSale,
  };
}

export async function fetchGameById(storeId: string): Promise<ScrapedGame | null> {
  const url =
    `${BASE_URL}/container/${COUNTRY}/${LANGUAGE}/${AGE}/${storeId}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });

    if (!res.ok || res.status === 204) {
      console.warn(`PS Store API ${res.status} for game ${storeId} (may be delisted)`);
      return null;
    }

    const text = await res.text();
    if (!text) {
      console.warn(`PS Store returned empty body for game ${storeId}`);
      return null;
    }

    const data = JSON.parse(text) as PsnGame;
    if (!data || !data.id) return null;
    return parseGame(data);
  } catch (err) {
    console.error(`PS Store fetch failed for game ${storeId}:`, err);
    return null;
  }
}

export class PsnScraper implements StoreScraper {
  readonly storeName = "psn";

  async scrapeAll(): Promise<ScrapedGame[]> {
    const allGames: ScrapedGame[] = [];
    const seen = new Set<string>();

    const firstPage = await fetchPage(0);
    if (!firstPage) return allGames;

    const total = firstPage.total_results;
    console.log(`PS Store India: ${total} total games to scrape`);

    const processPage = (data: PsnResponse) => {
      for (const raw of data.links ?? []) {
        if (seen.has(raw.id)) continue;
        seen.add(raw.id);
        allGames.push(parseGame(raw));
      }
    };

    processPage(firstPage);

    let start = PAGE_SIZE;
    while (start < total) {
      const data = await fetchPage(start);
      if (!data || !data.links?.length) break;
      processPage(data);
      start += PAGE_SIZE;
      // rate limit: ~1.5s between requests
      await new Promise((r) => setTimeout(r, 1500));
    }

    console.log(`Scraped ${allGames.length} games total`);
    return allGames;
  }
}
