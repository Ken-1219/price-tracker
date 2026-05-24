"use client";

import Link from "next/link";
import Image from "next/image";

interface GameCardProps {
  id: string;
  title: string;
  imageUrl: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  lowestPrice: number | null;
  discountPercent: number | null;
  isOnSale: boolean;
  platform: string | null;
  ratingScore?: number | null;
  genres?: string | null;
  priority?: boolean;
  variant?: "default" | "wide";
}

export function GameCard({
  id,
  title,
  imageUrl,
  currentPrice,
  originalPrice,
  lowestPrice,
  discountPercent,
  isOnSale,
  platform,
  ratingScore,
  genres,
  priority = false,
  variant = "default",
}: GameCardProps) {
  const isAtLowest =
    currentPrice !== null &&
    lowestPrice !== null &&
    currentPrice <= lowestPrice &&
    currentPrice > 0;

  if (variant === "wide") {
    return (
      <Link href={`/game/${id}`}>
        <div className="group flex rounded-xl border border-border bg-card hover:border-muted overflow-hidden transition-all duration-200">
          <div className="relative w-28 flex-shrink-0 bg-black/50">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={title}
                fill
                unoptimized
                className="object-cover"
                sizes="112px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted text-xs">
                N/A
              </div>
            )}
          </div>
          <div className="flex-1 p-3 min-w-0">
            <h3 className="text-sm font-medium truncate">{title}</h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted">
              {platform && <span>{platform}</span>}
              {ratingScore != null && (
                <span className="flex items-center gap-0.5">
                  <svg viewBox="0 0 20 20" className="h-3 w-3 text-yellow-400 fill-current">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {ratingScore.toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              {currentPrice != null ? (
                <>
                  <span className={`text-base font-bold ${isOnSale ? "text-success" : ""}`}>
                    ₹{currentPrice.toLocaleString("en-IN")}
                  </span>
                  {isOnSale && originalPrice && originalPrice !== currentPrice && (
                    <span className="text-xs text-muted line-through">
                      ₹{originalPrice.toLocaleString("en-IN")}
                    </span>
                  )}
                  {isOnSale && discountPercent && (
                    <span className="text-xs font-bold text-danger">-{discountPercent}%</span>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted">Price unavailable</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  const firstGenre = genres?.split(",")[0]?.trim();

  return (
    <Link href={`/game/${id}`}>
      <div className="group relative rounded-xl border border-border bg-card hover:border-muted transition-all duration-200 overflow-hidden h-full flex flex-col">
        <div className="relative aspect-square bg-black/50 overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              unoptimized
              loading={priority ? "eager" : "lazy"}
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted text-sm">
              No Image
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {isOnSale && discountPercent && (
            <div className="absolute top-2 right-2 rounded bg-danger px-1.5 py-0.5 text-[11px] font-bold">
              -{discountPercent}%
            </div>
          )}
          {isAtLowest && (
            <div className="absolute top-2 left-2 rounded bg-success px-1.5 py-0.5 text-[11px] font-bold">
              LOWEST
            </div>
          )}

          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
            <div className="flex items-center gap-1.5">
              {platform && (
                <span className="rounded bg-white/15 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-medium">
                  {platform}
                </span>
              )}
              {firstGenre && (
                <span className="rounded bg-white/15 backdrop-blur-sm px-1.5 py-0.5 text-[10px]">
                  {firstGenre}
                </span>
              )}
            </div>
            {ratingScore != null && (
              <span className="flex items-center gap-0.5 rounded bg-white/15 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-medium">
                <svg viewBox="0 0 20 20" className="h-2.5 w-2.5 text-yellow-400 fill-current">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {ratingScore.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        <div className="p-3 flex flex-col flex-1">
          <h3 className="text-sm font-medium line-clamp-1 mb-auto">{title}</h3>
          <div className="mt-2">
            {currentPrice != null ? (
              <div className="flex items-baseline gap-2">
                <span className={`text-base font-bold ${isOnSale ? "text-success" : ""}`}>
                  ₹{currentPrice.toLocaleString("en-IN")}
                </span>
                {isOnSale && originalPrice && originalPrice !== currentPrice && (
                  <span className="text-[11px] text-muted line-through">
                    ₹{originalPrice.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted">Price unavailable</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
