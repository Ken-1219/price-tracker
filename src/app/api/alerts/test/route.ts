import { NextResponse } from "next/server";
import { db } from "@/db";
import { alerts, games } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendTelegramMessage, formatPriceDropMessage } from "@/lib/telegram";

export async function POST(request: Request) {
  const { alertId, chatId } = await request.json();

  if (!alertId || !chatId) {
    return NextResponse.json({ error: "alertId and chatId required" }, { status: 400 });
  }

  const [result] = await db
    .select({ alert: alerts, game: games })
    .from(alerts)
    .innerJoin(games, eq(alerts.gameId, games.id))
    .where(and(eq(alerts.id, alertId), eq(alerts.telegramChatId, chatId)))
    .limit(1);

  if (!result) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const { alert, game } = result;
  const currentPrice = game.currentPrice ?? 0;
  const originalPrice = game.originalPrice ?? currentPrice;

  const message = [
    `🧪 <b>Test Alert</b>`,
    ``,
    `<b>${game.title}</b>`,
    ``,
    `💰 Current price: <b>₹${currentPrice.toLocaleString("en-IN")}</b>`,
    alert.targetPrice != null
      ? `🎯 Your target: ₹${alert.targetPrice.toLocaleString("en-IN")}`
      : `🔔 Alert type: Any price change`,
    alert.targetPrice != null && currentPrice <= alert.targetPrice
      ? `✅ Price is at or below your target!`
      : alert.targetPrice != null
        ? `⏳ Waiting for price to drop to your target.`
        : `⏳ Watching for any price change.`,
    ``,
    game.url ? `🔗 <a href="${game.url}">View on PS Store</a>` : "",
    ``,
    `<i>This is a test — real alerts fire when prices actually drop.</i>`,
  ]
    .filter(Boolean)
    .join("\n");

  const sent = await sendTelegramMessage(chatId, message);

  if (!sent) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
