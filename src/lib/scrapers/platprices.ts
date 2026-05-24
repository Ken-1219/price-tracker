import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const BASE_URL = "https://platprices.com";

export interface PlatPricePoint {
  date: string;
  price: number;
}

export async function searchGame(title: string): Promise<string | null> {
  try {
    const url = `${BASE_URL}/search.php?q=${encodeURIComponent(title)}&userregion=IN`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const normalizedQuery = normalize(title);
    let bestUrl: string | null = null;
    let bestScore = 0;

    $("a.game-container").each((_, el) => {
      const href = $(el).attr("href");
      const name = $(el).find(".game-name").text().trim();
      if (!href || !name) return;

      const score = similarity(normalizedQuery, normalize(name));
      if (score > bestScore) {
        bestScore = score;
        bestUrl = href;
      }
    });

    if (!bestUrl || bestScore < 0.4) return null;
    return `${BASE_URL}${bestUrl}?userregion=IN`;
  } catch (err) {
    console.warn(`PlatPrices search failed for "${title}":`, err);
    return null;
  }
}

export async function scrapePriceHistory(
  url: string
): Promise<PlatPricePoint[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return [];

    const html = await res.text();
    const match = html.match(/var salePrice = (\[.*?\]);/);
    if (!match) return [];

    const raw: Array<{ x: string; y: string }> = JSON.parse(match[1]);
    return raw.map((p) => ({
      date: p.x,
      price: parseInt(p.y.replace(/,/g, ""), 10),
    }));
  } catch (err) {
    console.warn(`PlatPrices scrape failed for ${url}:`, err);
    return [];
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const wordsA = new Set(a.split(" "));
  const wordsB = new Set(b.split(" "));
  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }
  return common / Math.max(wordsA.size, wordsB.size);
}
