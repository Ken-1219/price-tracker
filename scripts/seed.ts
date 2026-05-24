import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const PAGE_SIZE = 100;
const DELAY_MS = 1000;

interface PsnGame {
  id: string;
  name: string;
  default_sku?: {
    price?: number;
    display_price?: string;
    rewards?: Array<{
      price: number;
      display_price: string;
      discount: number;
      isPlus?: boolean;
    }>;
  };
  images?: Array<{ type: number; url: string }>;
  playable_platform?: string[];
  top_category?: string;
  game_contentType?: string;
}

function parseGame(game: PsnGame) {
  const sku = game.default_sku;
  const basePrice = sku?.price ?? null;
  const nonPlusReward = sku?.rewards?.find((r) => !r.isPlus);
  const isOnSale = nonPlusReward !== undefined && basePrice !== null;
  const currentPrice = isOnSale ? nonPlusReward.price : basePrice;
  const discountPercent = isOnSale ? nonPlusReward.discount : null;

  const image =
    game.images?.find((i) => i.type === 1) ??
    game.images?.find((i) => i.type === 10) ??
    game.images?.[0];

  const isPS5 =
    game.playable_platform?.some((p) => p.toUpperCase().includes("PS5")) ??
    false;

  return {
    id: `psn_${game.id}`,
    storeId: game.id,
    store: "psn" as const,
    title: game.name,
    imageUrl: image?.url ?? null,
    platform: isPS5 ? "PS5" : "PS4",
    category: game.top_category ?? game.game_contentType ?? null,
    currentPrice,
    originalPrice: basePrice,
    lowestPrice: currentPrice,
    highestPrice: currentPrice,
    discountPercent,
    isOnSale,
    url: `https://store.playstation.com/en-in/product/${game.id}`,
    lastChecked: new Date(),
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  const neonSql = neon(dbUrl);
  const db = drizzle(neonSql, { schema });

  // Clear existing data for a clean full import
  console.log("Clearing existing data...");
  await db.delete(schema.priceHistory);
  await db.delete(schema.alerts);
  await db.delete(schema.games);

  console.log("Fetching ALL games from PS Store India...\n");

  let start = 0;
  let total = Infinity;
  let pageNum = 0;
  let totalInserted = 0;
  const seen = new Set<string>();

  while (start < total) {
    const apiUrl =
      `https://store.playstation.com/store/api/chihiro/00_09_000/container/in/en/999/STORE-MSF75508-FULLGAMES` +
      `?size=${PAGE_SIZE}&start=${start}&gameContentType=games`;

    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error(`API returned ${res.status} at start=${start}, retrying...`);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const data = await res.json();
    total = data.total_results;
    const rawGames: PsnGame[] = data.links ?? [];

    if (rawGames.length === 0) break;

    const batch: ReturnType<typeof parseGame>[] = [];
    for (const raw of rawGames) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      batch.push(parseGame(raw));
    }

    if (batch.length > 0) {
      await db.insert(schema.games).values(batch);

      const historyBatch = batch
        .filter((g) => g.currentPrice !== null)
        .map((g) => ({
          gameId: g.id,
          price: g.currentPrice!,
          originalPrice: g.originalPrice,
          discountPercent: g.discountPercent,
        }));

      if (historyBatch.length > 0) {
        await db.insert(schema.priceHistory).values(historyBatch);
      }

      totalInserted += batch.length;
    }

    pageNum++;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const withPrice = batch.filter((g) => g.currentPrice !== null).length;
    process.stdout.write(
      `\r  Page ${pageNum}/${totalPages} | ${totalInserted}/${total} games | ${withPrice} priced this batch`
    );

    start += PAGE_SIZE;
    if (start < total) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // Get final counts
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.games);
  const [pricedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.games)
    .where(sql`current_price IS NOT NULL`);

  console.log(`\n\nDone!`);
  console.log(`  Total games: ${countResult.count}`);
  console.log(`  With prices: ${pricedResult.count}`);
  console.log(`  Without prices (upcoming): ${Number(countResult.count) - Number(pricedResult.count)}`);
}

main().catch(console.error);
