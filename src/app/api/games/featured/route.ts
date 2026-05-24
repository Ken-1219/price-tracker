import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { desc, eq, and, isNotNull, sql } from "drizzle-orm";

let cached: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 300_000;

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, { headers: { "X-Cache": "HIT" } });
  }

  const select = {
    id: games.id,
    title: games.title,
    imageUrl: games.imageUrl,
    currentPrice: games.currentPrice,
    originalPrice: games.originalPrice,
    lowestPrice: games.lowestPrice,
    discountPercent: games.discountPercent,
    isOnSale: games.isOnSale,
    platform: games.platform,
    ratingScore: games.ratingScore,
    ratingCount: games.ratingCount,
    genres: games.genres,
  };

  const [topRated, bestDeals, recentlyOnSale, lowestEver] = await Promise.all([
    db
      .select(select)
      .from(games)
      .where(
        and(isNotNull(games.ratingScore), sql`${games.ratingCount} > 100`)
      )
      .orderBy(desc(games.ratingCount))
      .limit(12),

    db
      .select(select)
      .from(games)
      .where(
        and(
          eq(games.isOnSale, true),
          isNotNull(games.discountPercent),
          sql`${games.discountPercent} >= 30`,
          isNotNull(games.currentPrice),
        )
      )
      .orderBy(desc(games.discountPercent))
      .limit(12),

    db
      .select(select)
      .from(games)
      .where(eq(games.isOnSale, true))
      .orderBy(desc(games.lastChecked))
      .limit(12),

    db
      .select(select)
      .from(games)
      .where(
        and(
          isNotNull(games.currentPrice),
          isNotNull(games.lowestPrice),
          sql`${games.currentPrice} <= ${games.lowestPrice}`,
          sql`${games.currentPrice} > 0`
        )
      )
      .orderBy(desc(games.ratingCount))
      .limit(12),
  ]);

  const data = { topRated, bestDeals, recentlyOnSale, lowestEver };
  cached = { data, ts: Date.now() };
  return NextResponse.json(data);
}
