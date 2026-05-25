"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";

interface Game {
  id: string;
  title: string;
  imageUrl: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  discountPercent: number | null;
  isOnSale: boolean;
  platform: string | null;
  url: string | null;
  lastChecked: string | null;
  description: string | null;
  publisher: string | null;
  releaseDate: string | null;
  genres: string | null;
  fileSize: number | null;
  ratingScore: number | null;
  ratingCount: number | null;
  screenshots: string | null;
  numberOfPlayers: string | null;
  category: string | null;
}

interface PricePoint {
  price: number;
  recordedAt: string;
}

function formatFileSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StarRating({ score }: { score: number }) {
  const full = Math.floor(score);
  const fraction = score - full;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${
            i < full
              ? "text-yellow-400"
              : i === full && fraction >= 0.5
                ? "text-yellow-400"
                : "text-border"
          }`}
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [game, setGame] = useState<Game | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertPrice, setAlertPrice] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState(0);

  const screenshots: string[] = game?.screenshots
    ? JSON.parse(game.screenshots)
    : [];

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/games/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setGame(data.game);
        setPriceHistory(data.priceHistory);
        if (data.game.lowestPrice) {
          setAlertPrice(String(data.game.lowestPrice));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function openTelegramAlert() {
    const price = parseFloat(alertPrice);
    if (!price || price <= 0) return;
    const botUsername =
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "price_tracker_psn_bot";
    const payload = btoa(`${id}:${price}`)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    window.open(`https://t.me/${botUsername}?start=${payload}`, "_blank");
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded bg-border/30" />
        <div className="h-[300px] rounded-xl bg-border/30" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-muted">Game not found</p>
        <Link href="/" className="text-accent mt-4 inline-block">
          Back to all games
        </Link>
      </div>
    );
  }

  const genreList = game.genres?.split(", ") ?? [];

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-muted hover:text-accent mb-6 inline-block"
      >
        &larr; Back to all games
      </Link>

      {/* Hero Section */}
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        {/* Left: Cover Art */}
        <div>
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border">
            {game.imageUrl ? (
              <Image
                src={game.imageUrl}
                alt={game.title}
                fill
                className="object-cover"
                sizes="300px"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-card text-muted">
                No Image
              </div>
            )}
            {game.isOnSale && game.discountPercent && (
              <div className="absolute top-3 right-3 rounded bg-danger px-2 py-1 text-sm font-bold">
                -{game.discountPercent}%
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 space-y-2">
            {game.url && (
              <a
                href={game.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#00439C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#003580] transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.153 0-3.234-1.965-5.096-5.427-6.178C11.388 3.09 8.984 2.596 8.984 2.596zM2 2.596v17.547l3.915 1.261V2.596H2zm14.28 10.08v5.972c0 .643-.264 1.152-.794.991-.636-.18-.76-.814-.76-1.505V12.28c-2.441-1.193-4.362.002-4.362 3.153 0 3.234 1.965 5.096 5.427 6.178 2 .656 4.409 1.15 4.409 1.15V5.213l-3.92-1.261v8.724z" />
                </svg>
                View on PS Store
              </a>
            )}
          </div>
        </div>

        {/* Right: Game Info */}
        <div className="space-y-6">
          {/* Title and Badges */}
          <div>
            <h1 className="text-3xl font-bold mb-3">{game.title}</h1>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {game.platform && (
                <span className="rounded bg-card border border-border px-2.5 py-1 text-xs font-medium">
                  {game.platform}
                </span>
              )}
              {genreList.map((g) => (
                <span
                  key={g}
                  className="rounded bg-accent/10 text-accent px-2.5 py-1 text-xs font-medium"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Rating */}
            {game.ratingScore !== null && (
              <div className="flex items-center gap-2">
                <StarRating score={game.ratingScore} />
                <span className="text-sm font-medium">
                  {game.ratingScore.toFixed(1)}
                </span>
                {game.ratingCount !== null && (
                  <span className="text-sm text-muted">
                    ({game.ratingCount.toLocaleString("en-IN")} ratings)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Price Card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-baseline gap-3">
              {game.currentPrice !== null ? (
                <>
                  <span
                    className={`text-4xl font-bold ${game.isOnSale ? "text-success" : ""}`}
                  >
                    ₹{game.currentPrice.toLocaleString("en-IN")}
                  </span>
                  {game.isOnSale && game.originalPrice && (
                    <span className="text-lg text-muted line-through">
                      ₹{game.originalPrice.toLocaleString("en-IN")}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-lg text-muted">Price unavailable</span>
              )}
            </div>

            {(game.lowestPrice !== null || game.highestPrice !== null) && (
              <div className="flex gap-6 mt-3 text-sm">
                {game.lowestPrice !== null && (
                  <div className="flex items-center gap-1.5">
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4 text-price-low"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-muted">Lowest:</span>
                    <span className="font-medium text-price-low">
                      ₹{game.lowestPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
                {game.highestPrice !== null && (
                  <div className="flex items-center gap-1.5">
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4 text-price-high"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-muted">Highest:</span>
                    <span className="font-medium text-price-high">
                      ₹{game.highestPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {game.description && (
            <div>
              <p className="text-sm text-muted leading-relaxed line-clamp-4">
                {game.description}
              </p>
            </div>
          )}

          {/* Game Details Grid */}
          {(game.publisher ||
            game.releaseDate ||
            game.fileSize ||
            game.numberOfPlayers) && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {game.releaseDate && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted mb-1">Release Date</p>
                  <p className="text-sm font-medium">
                    {formatDate(game.releaseDate)}
                  </p>
                </div>
              )}
              {game.publisher && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted mb-1">Publisher</p>
                  <p className="text-sm font-medium">{game.publisher}</p>
                </div>
              )}
              {game.fileSize && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted mb-1">Download Size</p>
                  <p className="text-sm font-medium">
                    {formatFileSize(game.fileSize)}
                  </p>
                </div>
              )}
              {game.numberOfPlayers && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted mb-1">Players</p>
                  <p className="text-sm font-medium">
                    {game.numberOfPlayers === "1"
                      ? "Single Player"
                      : `${game.numberOfPlayers} Players`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Screenshots */}
      {screenshots.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-4">Screenshots</h2>
          <div className="rounded-xl overflow-hidden border border-border bg-black">
            <div className="relative aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshots[selectedScreenshot]}
                alt={`${game.title} screenshot ${selectedScreenshot + 1}`}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          {screenshots.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              {screenshots.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedScreenshot(i)}
                  className={`relative flex-shrink-0 w-24 aspect-video rounded-lg overflow-hidden border-2 transition-colors ${
                    i === selectedScreenshot
                      ? "border-accent"
                      : "border-border hover:border-muted"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Thumbnail ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Price History Chart */}
      <div className="mt-10 rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold mb-4">Price History</h2>
        <PriceHistoryChart
          data={priceHistory}
          highestPrice={game.highestPrice}
          lowestPrice={game.lowestPrice}
        />
      </div>

      {/* Price Alert */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold mb-4">Set Price Alert</h2>
        <p className="text-sm text-muted mb-4">
          Get a Telegram notification when the price drops to your target.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-muted">₹</span>
            <input
              type="number"
              placeholder="Target price"
              value={alertPrice}
              onChange={(e) => setAlertPrice(e.target.value)}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm outline-none focus:border-accent w-32"
            />
          </div>
          <button
            onClick={openTelegramAlert}
            disabled={!alertPrice || parseFloat(alertPrice) <= 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2AABEE] px-6 py-2 text-sm font-medium text-white hover:bg-[#229ED9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Set Alert via Telegram
          </button>
        </div>
      </div>

      {/* Footer info */}
      {game.lastChecked && (
        <p className="mt-4 text-xs text-muted text-right">
          Last checked: {new Date(game.lastChecked).toLocaleString("en-IN")}
        </p>
      )}
    </div>
  );
}
