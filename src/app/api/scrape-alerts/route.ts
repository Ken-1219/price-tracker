import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, priceHistory, alerts } from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { fetchGameById } from "@/lib/scrapers/psn";
import { sendTelegramMessage, formatPriceDropMessage } from "@/lib/telegram";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeAlerts = await db
    .select({
      gameId: alerts.gameId,
      storeId: games.storeId,
      title: games.title,
      currentPrice: games.currentPrice,
      lowestPrice: games.lowestPrice,
      highestPrice: games.highestPrice,
    })
    .from(alerts)
    .innerJoin(games, eq(alerts.gameId, games.id))
    .where(eq(alerts.isActive, true))
    .groupBy(games.id, alerts.gameId);

  const uniqueGames = new Map(
    activeAlerts.map((a) => [a.storeId, a])
  );

  console.log(`Scraping ${uniqueGames.size} games with active alerts...`);

  let priceChanges = 0;
  let alertsSent = 0;

  for (const [storeId, game] of uniqueGames) {
    const scraped = await fetchGameById(storeId);
    if (!scraped || scraped.currentPrice === null) continue;

    const previousPrice = game.currentPrice;
    const lowestPrice =
      previousPrice !== null
        ? Math.min(scraped.currentPrice, game.lowestPrice ?? Infinity)
        : scraped.currentPrice;
    const highestPrice =
      previousPrice !== null
        ? Math.max(scraped.currentPrice, game.highestPrice ?? 0)
        : scraped.currentPrice;

    await db
      .update(games)
      .set({
        currentPrice: scraped.currentPrice,
        originalPrice: scraped.originalPrice,
        lowestPrice,
        highestPrice,
        discountPercent: scraped.discountPercent,
        isOnSale: scraped.isOnSale,
        lastChecked: new Date(),
      })
      .where(eq(games.id, game.gameId));

    if (previousPrice === null || previousPrice !== scraped.currentPrice) {
      await db.insert(priceHistory).values({
        gameId: game.gameId,
        price: scraped.currentPrice,
        originalPrice: scraped.originalPrice,
        discountPercent: scraped.discountPercent,
      });
      priceChanges++;
    }

    if (previousPrice !== null && scraped.currentPrice < previousPrice) {
      const gameAlerts = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.gameId, game.gameId),
            eq(alerts.isActive, true),
            lte(alerts.targetPrice, previousPrice)
          )
        );

      for (const alert of gameAlerts) {
        if (scraped.currentPrice <= alert.targetPrice) {
          const message = formatPriceDropMessage(
            scraped.title,
            scraped.currentPrice,
            previousPrice,
            game.lowestPrice ?? scraped.currentPrice,
            scraped.url
          );

          const sent = await sendTelegramMessage(
            alert.telegramChatId,
            message
          );

          if (sent) {
            await db
              .update(alerts)
              .set({ lastNotified: new Date() })
              .where(eq(alerts.id, alert.id));
            alertsSent++;
          }
        }
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `Alert scrape done: ${uniqueGames.size} games, ${priceChanges} price changes, ${alertsSent} alerts sent`
  );

  return NextResponse.json({
    success: true,
    gamesChecked: uniqueGames.size,
    priceChanges,
    alertsSent,
  });
}
