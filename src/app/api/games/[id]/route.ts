import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, priceHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { fetchGameMetadata } from "@/lib/scrapers/psn-metadata";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, id))
    .limit(1);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (!game.metadataFetched) {
    const metadata = await fetchGameMetadata(game.storeId);
    if (metadata) {
      await db
        .update(games)
        .set({ ...metadata, metadataFetched: true })
        .where(eq(games.id, id));
      game = { ...game, ...metadata, metadataFetched: true };
    } else {
      await db
        .update(games)
        .set({ metadataFetched: true })
        .where(eq(games.id, id));
      game = { ...game, metadataFetched: true };
    }
  }

  const history = await db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.gameId, id))
    .orderBy(desc(priceHistory.recordedAt));

  return NextResponse.json({ game, priceHistory: history });
}
