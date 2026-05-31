import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, priceHistory, alerts } from "@/db/schema";
import { eq, and, lte, or } from "drizzle-orm";
import { fetchGameById } from "@/lib/scrapers/psn";
import { sendTelegramMessage, formatPriceDropMessage, formatPriceChangeMessage } from "@/lib/telegram";

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

  const startTime = Date.now();
  console.log(`[scrape-alerts] Started at ${new Date().toISOString()}`);
  console.log(`[scrape-alerts] Found ${uniqueGames.size} unique games with active alerts`);

  let priceChanges = 0;
  let alertsSent = 0;
  let skipped = 0;
  let checked = 0;

  for (const [storeId, game] of uniqueGames) {
    const scraped = await fetchGameById(storeId);
    if (!scraped || scraped.currentPrice === null) {
      console.log(`[scrape-alerts] SKIP "${game.title}" (${storeId}) — no data from PSN`);
      skipped++;
      continue;
    }

    checked++;
    const previousPrice = game.currentPrice;
    console.log(
      `[scrape-alerts] ${checked}/${uniqueGames.size} "${game.title}" — ` +
      `prev: ₹${previousPrice ?? "N/A"}, now: ₹${scraped.currentPrice}` +
      (previousPrice !== null && scraped.currentPrice !== previousPrice
        ? ` (${scraped.currentPrice < previousPrice ? "↓ DROP" : "↑ UP"})`
        : " (no change)")
    );

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
      console.log(`[scrape-alerts] Recorded price change for "${game.title}"`);
    }

    if (previousPrice !== null && scraped.currentPrice !== previousPrice) {
      const isPriceDrop = scraped.currentPrice < previousPrice;

      const gameAlerts = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.gameId, game.gameId),
            eq(alerts.isActive, true),
            or(
              eq(alerts.alertType, "any_change"),
              isPriceDrop
                ? and(eq(alerts.alertType, "drop"), lte(alerts.targetPrice, previousPrice))
                : undefined
            )
          )
        );

      console.log(`[scrape-alerts] Price ${isPriceDrop ? "drop" : "increase"} on "${game.title}" — checking ${gameAlerts.length} alert(s)`);

      for (const alert of gameAlerts) {
        if (alert.alertType === "any_change") {
          console.log(
            `[scrape-alerts] ANY_CHANGE ALERT — "${game.title}" ₹${previousPrice} → ₹${scraped.currentPrice} ` +
            `(chat: ${alert.telegramChatId})`
          );

          const message = formatPriceChangeMessage(
            scraped.title,
            scraped.currentPrice,
            previousPrice,
            game.lowestPrice ?? scraped.currentPrice,
            scraped.url
          );

          const sent = await sendTelegramMessage(alert.telegramChatId, message);
          if (sent) {
            await db.update(alerts).set({ lastNotified: new Date() }).where(eq(alerts.id, alert.id));
            alertsSent++;
            console.log(`[scrape-alerts] Telegram sent to ${alert.telegramChatId}`);
          } else {
            console.error(`[scrape-alerts] FAILED to send Telegram to ${alert.telegramChatId}`);
          }
        } else if (isPriceDrop && alert.targetPrice !== null && scraped.currentPrice <= alert.targetPrice) {
          console.log(
            `[scrape-alerts] DROP ALERT TRIGGERED — "${game.title}" ₹${previousPrice} → ₹${scraped.currentPrice} ` +
            `(target: ₹${alert.targetPrice}, chat: ${alert.telegramChatId})`
          );

          const message = formatPriceDropMessage(
            scraped.title,
            scraped.currentPrice,
            previousPrice,
            game.lowestPrice ?? scraped.currentPrice,
            scraped.url
          );

          const sent = await sendTelegramMessage(alert.telegramChatId, message);
          if (sent) {
            await db.update(alerts).set({ lastNotified: new Date() }).where(eq(alerts.id, alert.id));
            alertsSent++;
            console.log(`[scrape-alerts] Telegram sent to ${alert.telegramChatId}`);
          } else {
            console.error(`[scrape-alerts] FAILED to send Telegram to ${alert.telegramChatId}`);
          }
        } else {
          console.log(
            `[scrape-alerts] Alert not triggered — "${game.title}" now ₹${scraped.currentPrice}, ` +
            `target ₹${alert.targetPrice} not met`
          );
        }
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[scrape-alerts] Done in ${elapsed}s — ` +
    `checked: ${checked}, skipped: ${skipped}, ` +
    `price changes: ${priceChanges}, alerts sent: ${alertsSent}`
  );

  return NextResponse.json({
    success: true,
    gamesChecked: checked,
    gamesSkipped: skipped,
    priceChanges,
    alertsSent,
    elapsedSeconds: parseFloat(elapsed),
  });
}
