import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const BASE_URL = "https://store.playstation.com/store/api/chihiro/00_09_000";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const DELAY_MS = 300;

async function fetchMeta(storeId: string) {
  try {
    const res = await fetch(`${BASE_URL}/container/in/en/999/${storeId}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data.metadata ?? {};

    const descRaw = data.long_desc ?? "";
    const description =
      descRaw
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000) || null;

    const genreValues: string[] = meta.game_genre?.values ?? [];
    const subgenreValues: string[] = meta.game_subgenre?.values ?? [];
    const allGenres = [...genreValues, ...subgenreValues].map(
      (g) => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase()
    );

    let fileSize: number | null = null;
    const skus = data.skus ?? [];
    if (skus.length > 0) {
      for (const ent of skus[0].entitlements ?? []) {
        const pkgs = ent.packages ?? [];
        if (pkgs.length > 0 && pkgs[0].size) {
          fileSize = pkgs[0].size;
          break;
        }
      }
    }

    const screenshotList: string[] = [];
    for (const s of (data.mediaList?.screenshots ?? [])) {
      if (s.url) screenshotList.push(s.url);
    }

    const sr = data.star_rating ?? {};

    return {
      description,
      publisher: data.provider_name ?? null,
      releaseDate: data.release_date ?? null,
      genres: allGenres.length > 0 ? allGenres.join(", ") : null,
      fileSize,
      ratingScore: sr.score ? parseFloat(sr.score) : null,
      ratingCount: sr.total ? parseInt(sr.total, 10) : null,
      screenshots:
        screenshotList.length > 0 ? JSON.stringify(screenshotList) : null,
      numberOfPlayers:
        (meta.cn_numberOfPlayers?.values ?? [])[0] ?? null,
      metadataFetched: true,
    };
  } catch {
    return null;
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 5000;
  const offsetIdx = args.indexOf("--offset");
  const offset = offsetIdx !== -1 ? parseInt(args[offsetIdx + 1], 10) : 0;

  const neonSql = neon(dbUrl);
  const db = drizzle(neonSql, { schema });

  const gamesToProcess = await db
    .select({ id: schema.games.id, storeId: schema.games.storeId, title: schema.games.title })
    .from(schema.games)
    .where(eq(schema.games.metadataFetched, false))
    .orderBy(schema.games.id)
    .offset(offset)
    .limit(limit);

  console.log(`Fetching metadata for ${gamesToProcess.length} games\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < gamesToProcess.length; i++) {
    const game = gamesToProcess[i];
    process.stdout.write(`[${i + 1}/${gamesToProcess.length}] "${game.title}" -> `);

    const meta = await fetchMeta(game.storeId);

    if (meta) {
      await db.update(schema.games).set(meta).where(eq(schema.games.id, game.id));
      const rating = meta.ratingScore ? ` (${meta.ratingScore.toFixed(1)} stars)` : "";
      console.log(`ok${rating}`);
      success++;
    } else {
      await db
        .update(schema.games)
        .set({ metadataFetched: true })
        .where(eq(schema.games.id, game.id));
      console.log("no data");
      failed++;
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDone! Success: ${success}, No data: ${failed}`);
}

main().catch(console.error);
