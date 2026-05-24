import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import {
  searchGame,
  scrapePriceHistory,
} from "../src/lib/scrapers/platprices";

const DELAY_MS = 1500;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  const args = process.argv.slice(2);
  const offsetIdx = args.indexOf("--offset");
  const limitIdx = args.indexOf("--limit");
  const offset = offsetIdx !== -1 ? parseInt(args[offsetIdx + 1], 10) : 0;
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 5000;

  const neonSql = neon(dbUrl);
  const db = drizzle(neonSql, { schema });

  const gamesToProcess = await db
    .select({ id: schema.games.id, title: schema.games.title })
    .from(schema.games)
    .where(eq(schema.games.platpricesChecked, false))
    .orderBy(schema.games.id)
    .offset(offset)
    .limit(limit);

  console.log(
    `Processing ${gamesToProcess.length} games (offset=${offset}, limit=${limit})\n`
  );

  let found = 0;
  let notFound = 0;
  let totalPoints = 0;

  for (let i = 0; i < gamesToProcess.length; i++) {
    const game = gamesToProcess[i];
    process.stdout.write(
      `[${i + 1}/${gamesToProcess.length}] "${game.title}" -> `
    );

    const platUrl = await searchGame(game.title);
    await delay(DELAY_MS);

    if (!platUrl) {
      console.log("not found");
      await db
        .update(schema.games)
        .set({ platpricesChecked: true })
        .where(eq(schema.games.id, game.id));
      notFound++;
      continue;
    }

    const history = await scrapePriceHistory(platUrl);
    await delay(DELAY_MS);

    if (history.length > 0) {
      const historyRows = history
        .filter((p) => {
          const d = new Date(p.date);
          return !isNaN(d.getTime());
        })
        .map((p) => ({
          gameId: game.id,
          price: p.price,
          source: "platprices",
          recordedAt: new Date(p.date),
        }));

      for (let j = 0; j < historyRows.length; j += 50) {
        await db
          .insert(schema.priceHistory)
          .values(historyRows.slice(j, j + 50));
      }

      const prices = history.map((p) => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      await db
        .update(schema.games)
        .set({
          platpricesUrl: platUrl,
          platpricesChecked: true,
          lowestPrice: sql`LEAST(${schema.games.lowestPrice}, ${minPrice})`,
          highestPrice: sql`GREATEST(${schema.games.highestPrice}, ${maxPrice})`,
        })
        .where(eq(schema.games.id, game.id));

      totalPoints += historyRows.length;
      found++;
      console.log(`found (${historyRows.length} price points)`);
    } else {
      await db
        .update(schema.games)
        .set({ platpricesUrl: platUrl, platpricesChecked: true })
        .where(eq(schema.games.id, game.id));
      found++;
      console.log("found (no price data)");
    }
  }

  console.log(`\nDone!`);
  console.log(`  Found: ${found}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Total price points: ${totalPoints}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch(console.error);
