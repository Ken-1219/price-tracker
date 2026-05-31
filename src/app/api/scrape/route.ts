import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, priceHistory, alerts } from "@/db/schema";
import { eq, and, lte, inArray, sql, or } from "drizzle-orm";
import { getScraper } from "@/lib/scrapers";
import { sendTelegramMessage, formatPriceDropMessage, formatPriceChangeMessage } from "@/lib/telegram";
import { searchGame, scrapePriceHistory } from "@/lib/scrapers/platprices";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = "psn";
  const scraper = getScraper(store);

  console.log(`Starting ${store} scrape...`);
  const scrapedGames = await scraper.scrapeAll();
  console.log(`Scraped ${scrapedGames.length} games`);

  let newGames = 0;
  let priceChanges = 0;
  let alertsSent = 0;

  const BATCH = 50;
  for (let i = 0; i < scrapedGames.length; i += BATCH) {
    const batch = scrapedGames.slice(i, i + BATCH);
    const batchIds = batch.map((g) => `${store}_${g.storeId}`);

    const existingRows = await db
      .select()
      .from(games)
      .where(inArray(games.id, batchIds));

    const existingMap = new Map(existingRows.map((r) => [r.id, r]));

    const toInsert: (typeof games.$inferInsert)[] = [];
    const historyInserts: Array<{
      gameId: string;
      price: number;
      originalPrice: number | null;
      discountPercent: number | null;
    }> = [];

    for (const scraped of batch) {
      const gameId = `${store}_${scraped.storeId}`;
      const existing = existingMap.get(gameId);
      const previousPrice = existing?.currentPrice ?? null;

      if (!existing) {
        toInsert.push({
          id: gameId,
          storeId: scraped.storeId,
          store: "psn" as const,
          title: scraped.title,
          imageUrl: scraped.imageUrl,
          platform: scraped.platform,
          category: scraped.category,
          currentPrice: scraped.currentPrice,
          originalPrice: scraped.originalPrice,
          lowestPrice: scraped.currentPrice,
          highestPrice: scraped.currentPrice,
          discountPercent: scraped.discountPercent,
          isOnSale: scraped.isOnSale,
          url: scraped.url,
          lastChecked: new Date(),
        });
        newGames++;

        if (scraped.currentPrice !== null) {
          historyInserts.push({
            gameId,
            price: scraped.currentPrice,
            originalPrice: scraped.originalPrice,
            discountPercent: scraped.discountPercent,
          });
        }
      } else {
        const lowestPrice =
          scraped.currentPrice !== null
            ? Math.min(scraped.currentPrice, existing.lowestPrice ?? Infinity)
            : existing.lowestPrice;
        const highestPrice =
          scraped.currentPrice !== null
            ? Math.max(scraped.currentPrice, existing.highestPrice ?? 0)
            : existing.highestPrice;

        await db
          .update(games)
          .set({
            title: scraped.title,
            imageUrl: scraped.imageUrl,
            currentPrice: scraped.currentPrice,
            originalPrice: scraped.originalPrice,
            lowestPrice,
            highestPrice,
            discountPercent: scraped.discountPercent,
            isOnSale: scraped.isOnSale,
            url: scraped.url,
            lastChecked: new Date(),
          })
          .where(eq(games.id, gameId));

        if (
          scraped.currentPrice !== null &&
          (previousPrice === null || previousPrice !== scraped.currentPrice)
        ) {
          historyInserts.push({
            gameId,
            price: scraped.currentPrice,
            originalPrice: scraped.originalPrice,
            discountPercent: scraped.discountPercent,
          });
          priceChanges++;
        }

        if (
          scraped.currentPrice !== null &&
          previousPrice !== null &&
          scraped.currentPrice !== previousPrice
        ) {
          const isPriceDrop = scraped.currentPrice < previousPrice;

          const activeAlerts = await db
            .select()
            .from(alerts)
            .where(
              and(
                eq(alerts.gameId, gameId),
                eq(alerts.isActive, true),
                or(
                  eq(alerts.alertType, "any_change"),
                  isPriceDrop
                    ? and(eq(alerts.alertType, "drop"), lte(alerts.targetPrice, previousPrice))
                    : undefined
                )
              )
            );

          for (const alert of activeAlerts) {
            if (alert.alertType === "any_change") {
              const message = formatPriceChangeMessage(
                scraped.title,
                scraped.currentPrice,
                previousPrice,
                existing.lowestPrice ?? scraped.currentPrice,
                scraped.url
              );
              const sent = await sendTelegramMessage(alert.telegramChatId, message);
              if (sent) {
                await db.update(alerts).set({ lastNotified: new Date() }).where(eq(alerts.id, alert.id));
                alertsSent++;
              }
            } else if (isPriceDrop && alert.targetPrice !== null && scraped.currentPrice <= alert.targetPrice) {
              const message = formatPriceDropMessage(
                scraped.title,
                scraped.currentPrice,
                previousPrice,
                existing.lowestPrice ?? scraped.currentPrice,
                scraped.url
              );
              const sent = await sendTelegramMessage(alert.telegramChatId, message);
              if (sent) {
                await db.update(alerts).set({ lastNotified: new Date() }).where(eq(alerts.id, alert.id));
                alertsSent++;
              }
            }
          }
        }
      }
    }

    if (toInsert.length > 0) {
      await db.insert(games).values(toInsert);
    }
    if (historyInserts.length > 0) {
      await db.insert(priceHistory).values(historyInserts);
    }
  }

  // Phase 2: Fetch PlatPrices history for unchecked games
  let platpricesFetched = 0;
  const uncheckedGames = await db
    .select({ id: games.id, title: games.title })
    .from(games)
    .where(eq(games.platpricesChecked, false))
    .limit(10);

  for (const game of uncheckedGames) {
    try {
      const platUrl = await searchGame(game.title);
      await new Promise((r) => setTimeout(r, 1000));

      if (!platUrl) {
        await db
          .update(games)
          .set({ platpricesChecked: true })
          .where(eq(games.id, game.id));
        continue;
      }

      const history = await scrapePriceHistory(platUrl);
      await new Promise((r) => setTimeout(r, 1000));

      if (history.length > 0) {
        const historyRows = history
          .filter((p) => !isNaN(new Date(p.date).getTime()))
          .map((p) => ({
            gameId: game.id,
            price: p.price,
            source: "platprices",
            recordedAt: new Date(p.date),
          }));
        if (historyRows.length > 0) await db.insert(priceHistory).values(historyRows);

        const prices = history.map((p) => p.price);
        await db
          .update(games)
          .set({
            platpricesUrl: platUrl,
            platpricesChecked: true,
            lowestPrice: sql`LEAST(${games.lowestPrice}, ${Math.min(...prices)})`,
            highestPrice: sql`GREATEST(${games.highestPrice}, ${Math.max(...prices)})`,
          })
          .where(eq(games.id, game.id));
      } else {
        await db
          .update(games)
          .set({ platpricesUrl: platUrl, platpricesChecked: true })
          .where(eq(games.id, game.id));
      }
      platpricesFetched++;
    } catch (err) {
      console.warn(`PlatPrices failed for ${game.title}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    store,
    totalScraped: scrapedGames.length,
    newGames,
    priceChanges,
    alertsSent,
    platpricesFetched,
  });
}
