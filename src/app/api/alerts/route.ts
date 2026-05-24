import { NextResponse } from "next/server";
import { db } from "@/db";
import { alerts, games } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  const body = await request.json();
  const { gameId, telegramChatId, targetPrice } = body;

  if (!gameId || !telegramChatId || !targetPrice) {
    return NextResponse.json(
      { error: "gameId, telegramChatId, and targetPrice are required" },
      { status: 400 }
    );
  }

  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const [alert] = await db
    .insert(alerts)
    .values({
      gameId,
      telegramChatId: String(telegramChatId),
      targetPrice: parseFloat(targetPrice),
    })
    .returning();

  return NextResponse.json({ alert });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return NextResponse.json(
      { error: "chatId is required" },
      { status: 400 }
    );
  }

  const result = await db
    .select({
      alert: alerts,
      game: games,
    })
    .from(alerts)
    .innerJoin(games, eq(alerts.gameId, games.id))
    .where(
      and(eq(alerts.telegramChatId, chatId), eq(alerts.isActive, true))
    );

  return NextResponse.json({ alerts: result });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const alertId = searchParams.get("id");

  if (!alertId) {
    return NextResponse.json(
      { error: "id is required" },
      { status: 400 }
    );
  }

  await db
    .update(alerts)
    .set({ isActive: false })
    .where(eq(alerts.id, parseInt(alertId)));

  return NextResponse.json({ success: true });
}
