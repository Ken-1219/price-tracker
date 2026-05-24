const BASE_URL = "https://store.playstation.com/store/api/chihiro/00_09_000";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

export interface GameMetadata {
  description: string | null;
  publisher: string | null;
  releaseDate: string | null;
  genres: string | null;
  fileSize: number | null;
  ratingScore: number | null;
  ratingCount: number | null;
  screenshots: string | null;
  numberOfPlayers: string | null;
}

export async function fetchGameMetadata(
  storeId: string
): Promise<GameMetadata | null> {
  try {
    const url = `${BASE_URL}/container/in/en/999/${storeId}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const meta = data.metadata ?? {};

    const descRaw = data.long_desc ?? "";
    const description = descRaw
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000) || null;

    const genreValues: string[] = meta.game_genre?.values ?? [];
    const subgenreValues: string[] = meta.game_subgenre?.values ?? [];
    const allGenres = [...genreValues, ...subgenreValues].map(
      (g) => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase()
    );
    const genres = allGenres.length > 0 ? allGenres.join(", ") : null;

    let fileSize: number | null = null;
    const skus = data.skus ?? [];
    if (skus.length > 0) {
      const ents = skus[0].entitlements ?? [];
      for (const ent of ents) {
        const pkgs = ent.packages ?? [];
        if (pkgs.length > 0 && pkgs[0].size) {
          fileSize = pkgs[0].size;
          break;
        }
      }
    }

    const screenshotList: string[] = [];
    const mediaList = data.mediaList ?? {};
    const screenshotMedia = mediaList.screenshots ?? [];
    for (const s of screenshotMedia) {
      if (s.url) screenshotList.push(s.url);
    }

    const starRating = data.star_rating ?? {};
    const ratingScore = starRating.score ? parseFloat(starRating.score) : null;
    const ratingCount = starRating.total ? parseInt(starRating.total, 10) : null;

    const playersRaw: string[] = meta.cn_numberOfPlayers?.values ?? [];
    const numberOfPlayers = playersRaw.length > 0 ? playersRaw[0] : null;

    return {
      description,
      publisher: data.provider_name ?? null,
      releaseDate: data.release_date ?? null,
      genres,
      fileSize,
      ratingScore,
      ratingCount,
      screenshots:
        screenshotList.length > 0 ? JSON.stringify(screenshotList) : null,
      numberOfPlayers,
    };
  } catch (err) {
    console.warn(`Failed to fetch metadata for ${storeId}:`, err);
    return null;
  }
}
