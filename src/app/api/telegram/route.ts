import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, alerts } from "@/db/schema";
import { ilike, eq, and } from "drizzle-orm";
import { sendTelegramMessage } from "@/lib/telegram";

const APP_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://price-tracker-psn.vercel.app";

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
        "",
        `<a href="${APP_URL}">Open PriceTracker</a> — Browse games and set alerts`,
      ].join("\n")
    );
  } else if (text.startsWith("/start ")) {
    const payload = text.slice(7).trim();

    if (payload === "connect") {
      const alertsUrl = `${APP_URL}/alerts?chatId=${chatId}`;
      await sendTelegramMessage(
        chatId,
        [
          "🔗 <b>Account connected!</b>",
          "",
          `Your Chat ID: <code>${chatId}</code>`,
          "",
          `<a href="${alertsUrl}">📋 View your alerts on the web</a>`,
          "",
          "This link will always show your latest alerts.",
        ].join("\n")
      );
      return NextResponse.json({ ok: true });
    }

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

      const alertsUrl = `${APP_URL}/alerts?chatId=${chatId}`;

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
          "",
          `<a href="${alertsUrl}">📋 View all your alerts</a>`,
        ].join("\n")
      );
    } catch {
      await sendTelegramMessage(
        chatId,
        "Something went wrong creating the alert. Please try again from the web app."
      );
    }
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
        return `• <b>${g.title}</b>\n  Price: ${price}\n  <a href="${APP_URL}/game/${g.id}">View details</a>`;
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

    const alertsUrl = `${APP_URL}/alerts?chatId=${chatId}`;

    if (result.length === 0) {
      await sendTelegramMessage(
        chatId,
        [
          "You have no active price alerts.",
          "",
          `<a href="${APP_URL}">Browse games</a> to set up alerts.`,
        ].join("\n")
      );
    } else {
      const lines = result.map((r) => {
        const current = r.game.currentPrice?.toLocaleString("en-IN") ?? "N/A";
        const target = r.alert.targetPrice.toLocaleString("en-IN");
        const status =
          r.game.currentPrice != null && r.game.currentPrice <= r.alert.targetPrice
            ? " ✅"
            : "";
        return `• <b>${r.game.title}</b>${status}\n  Target: ₹${target} | Current: ₹${current}`;
      });

      await sendTelegramMessage(
        chatId,
        [
          `📋 <b>Your Alerts (${result.length}):</b>`,
          "",
          ...lines,
          "",
          `<a href="${alertsUrl}">Manage alerts on web</a>`,
        ].join("\n")
      );
    }
  } else if (text === "/chatid") {
    await sendTelegramMessage(
      chatId,
      `Your chat ID is: <code>${chatId}</code>`
    );
  }

  return NextResponse.json({ ok: true });
}
