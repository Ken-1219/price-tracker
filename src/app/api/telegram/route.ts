import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, alerts } from "@/db/schema";
import { ilike, eq, and } from "drizzle-orm";
import { sendTelegramMessage } from "@/lib/telegram";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

export async function POST(request: Request) {
  const update: TelegramUpdate = await request.json();
  const message = update.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  if (text === "/start") {
    await sendTelegramMessage(
      chatId,
      [
        "🎮 <b>PriceTracker Bot</b>",
        "",
        "Track PS5 game prices and get alerts!",
        "",
        "<b>Commands:</b>",
        "/search <i>game name</i> — Find a game",
        "/alerts — View your active alerts",
        "/chatid — Get your chat ID",
        "",
        "Set alerts via the web app — just click the Telegram button on any game page!",
      ].join("\n")
    );
  } else if (text.startsWith("/start ")) {
    const payload = text.slice(7).trim();
    try {
      const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      const separatorIdx = decoded.lastIndexOf(":");
      if (separatorIdx === -1) throw new Error("Invalid payload");
      const gameId = decoded.slice(0, separatorIdx);
      const targetPrice = parseFloat(decoded.slice(separatorIdx + 1));
      if (!gameId || isNaN(targetPrice) || targetPrice <= 0)
        throw new Error("Invalid data");

      const [game] = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1);

      if (!game) {
        await sendTelegramMessage(chatId, "Game not found. It may have been removed.");
        return NextResponse.json({ ok: true });
      }

      await db.insert(alerts).values({
        gameId,
        telegramChatId: chatId,
        targetPrice,
      });

      const currentPriceStr = game.currentPrice
        ? `₹${game.currentPrice.toLocaleString("en-IN")}`
        : "N/A";

      await sendTelegramMessage(
        chatId,
        [
          "✅ <b>Alert created!</b>",
          "",
          `<b>${game.title}</b>`,
          `Current price: ${currentPriceStr}`,
          `Alert when: ≤ ₹${targetPrice.toLocaleString("en-IN")}`,
          "",
          "I'll message you when the price drops to your target.",
        ].join("\n")
      );
    } catch {
      await sendTelegramMessage(
        chatId,
        "Something went wrong creating the alert. Please try again from the web app."
      );
    }
  } else if (text === "/chatid") {
    await sendTelegramMessage(
      chatId,
      `Your chat ID is: <code>${chatId}</code>`
    );
  } else if (text.startsWith("/search ")) {
    const query = text.slice(8).trim();
    if (!query) {
      await sendTelegramMessage(chatId, "Usage: /search <game name>");
      return NextResponse.json({ ok: true });
    }

    const results = await db
      .select()
      .from(games)
      .where(ilike(games.title, `%${query}%`))
      .limit(5);

    if (results.length === 0) {
      await sendTelegramMessage(chatId, `No games found for "${query}".`);
    } else {
      const lines = results.map((g) => {
        const price = g.currentPrice
          ? `₹${g.currentPrice.toLocaleString("en-IN")}`
          : "N/A";
        const lowest = g.lowestPrice
          ? `₹${g.lowestPrice.toLocaleString("en-IN")}`
          : "N/A";
        return `• <b>${g.title}</b>\n  Price: ${price} | Lowest: ${lowest}\n  ID: <code>${g.id}</code>`;
      });

      await sendTelegramMessage(
        chatId,
        [`🔍 Results for "${query}":`, "", ...lines].join("\n")
      );
    }
  } else if (text === "/alerts") {
    const result = await db
      .select({ alert: alerts, game: games })
      .from(alerts)
      .innerJoin(games, eq(alerts.gameId, games.id))
      .where(
        and(eq(alerts.telegramChatId, chatId), eq(alerts.isActive, true))
      );

    if (result.length === 0) {
      await sendTelegramMessage(chatId, "You have no active price alerts.");
    } else {
      const lines = result.map(
        (r) =>
          `• <b>${r.game.title}</b>\n  Alert when ≤ ₹${r.alert.targetPrice.toLocaleString("en-IN")} (currently ₹${r.game.currentPrice?.toLocaleString("en-IN") ?? "N/A"})`
      );

      await sendTelegramMessage(
        chatId,
        [`📋 <b>Your Alerts:</b>`, "", ...lines].join("\n")
      );
    }
  }

  return NextResponse.json({ ok: true });
}
