import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { desc, asc, eq, sql } from "drizzle-orm";

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value!;
    cache.delete(oldest);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "24"), 100);
  const sort = searchParams.get("sort") ?? "title";
  const search = searchParams.get("search") ?? "";
  const onSale = searchParams.get("onSale") === "true";
  const filter = searchParams.get("filter") ?? "";

  const cacheKey = `${search}|${sort}|${onSale}|${filter}|${page}|${limit}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  const offset = (page - 1) * limit;

  if (search) {
    const result = await searchGames(search, onSale, sort, limit, offset);
    setCache(cacheKey, result);
    return NextResponse.json(result);
  }

  const conditions = [];
  if (onSale) {
    conditions.push(sql`${games.isOnSale} = true`);
  }
  if (filter === "popular") {
    conditions.push(sql`${games.ratingCount} IS NOT NULL`);
  }

  const where =
    conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : undefined;

  const sortMap: Record<string, ReturnType<typeof asc>> = {
    title: asc(games.title),
    price_asc: asc(games.currentPrice),
    price_desc: desc(games.currentPrice),
    discount: desc(games.discountPercent),
    newest: desc(games.createdAt),
    popular: desc(games.ratingCount),
  };

  const orderBy = sortMap[sort] ?? asc(games.title);

  const [result, countResult] = await Promise.all([
    db.select().from(games).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(where),
  ]);

  const response = {
    games: result,
    pagination: {
      page,
      limit,
      total: Number(countResult[0].count),
      totalPages: Math.ceil(Number(countResult[0].count) / limit),
    },
  };

  setCache(cacheKey, response);
  return NextResponse.json(response);
}

async function searchGames(
  search: string,
  onSale: boolean,
  sort: string,
  limit: number,
  offset: number
) {
  const onSaleFilter = onSale ? sql` AND ${games.isOnSale} = true` : sql``;

  const orderClause =
    sort === "relevance" || sort === "title"
      ? sql`sim DESC`
      : sort === "price_asc"
        ? sql`${games.currentPrice} ASC NULLS LAST`
        : sort === "price_desc"
          ? sql`${games.currentPrice} DESC NULLS LAST`
          : sort === "discount"
            ? sql`${games.discountPercent} DESC NULLS LAST`
            : sql`sim DESC`;

  const [result, countResult] = await Promise.all([
    db.execute(sql`
      SELECT *, similarity(${games.title}, ${search}) as sim
      FROM ${games}
      WHERE (${games.title} % ${search} OR ${games.title} ILIKE ${"%" + search + "%"})
      ${onSaleFilter}
      ORDER BY ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `),
    db.execute(sql`
      SELECT count(*) as count
      FROM ${games}
      WHERE (${games.title} % ${search} OR ${games.title} ILIKE ${"%" + search + "%"})
      ${onSaleFilter}
    `),
  ]);

  const total = Number((countResult.rows[0] as { count: string }).count);

  const mapped = result.rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    storeId: r.store_id,
    store: r.store,
    title: r.title,
    imageUrl: r.image_url,
    platform: r.platform,
    category: r.category,
    currentPrice: r.current_price,
    originalPrice: r.original_price,
    lowestPrice: r.lowest_price,
    highestPrice: r.highest_price,
    discountPercent: r.discount_percent,
    isOnSale: r.is_on_sale,
    url: r.url,
    ratingScore: r.rating_score,
    ratingCount: r.rating_count,
    genres: r.genres,
  }));

  return {
    games: mapped,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
