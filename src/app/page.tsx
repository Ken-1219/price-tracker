"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { GameCard } from "@/components/GameCard";
import Link from "next/link";

interface Game {
  id: string;
  title: string;
  imageUrl: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  lowestPrice: number | null;
  discountPercent: number | null;
  isOnSale: boolean;
  platform: string | null;
  ratingScore: number | null;
  ratingCount: number | null;
  genres: string | null;
}

interface FeaturedData {
  topRated: Game[];
  bestDeals: Game[];
  recentlyOnSale: Game[];
  lowestEver: Game[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type ViewMode = "home" | "browse";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [featured, setFeatured] = useState<FeaturedData | null>(null);
  const [browseGames, setBrowseGames] = useState<Game[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("popular");
  const [onSale, setOnSale] = useState(false);
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    async function loadFeatured() {
      try {
        const res = await fetch("/api/games/featured");
        const data = await res.json();
        setFeatured(data);
      } catch (err) {
        console.error("Failed to load featured:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFeatured();
  }, []);

  const fetchBrowse = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "24",
      sort: debouncedSearch ? "relevance" : sort,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(onSale && !debouncedSearch && { onSale: "true" }),
      ...(sort === "popular" && !debouncedSearch && { filter: "popular" }),
    });
    try {
      const res = await fetch(`/api/games?${params}`);
      const data = await res.json();
      setBrowseGames(data.games);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, onSale]);

  useEffect(() => {
    if (viewMode === "browse") fetchBrowse();
  }, [viewMode, fetchBrowse]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      if (search) setViewMode("browse");
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort, onSale]);

  function switchToBrowse(newSort: string, sale: boolean) {
    setSort(newSort);
    setOnSale(sale);
    setPage(1);
    setViewMode("browse");
  }

  return (
    <div>
      {/* Hero */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-1">
          PlayStation Store <span className="text-accent">India</span>
        </h1>
        <p className="text-muted">
          Track prices, view history, and get alerted on drops.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search for any game..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-card pl-12 pr-10 py-3.5 text-sm text-foreground placeholder-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
        />
        {search && (
          <button
            onClick={() => {
              setSearch("");
              setDebouncedSearch("");
              setViewMode("home");
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {viewMode === "home" && !loading && featured ? (
        <HomeView
          featured={featured}
          onBrowse={switchToBrowse}
        />
      ) : viewMode === "browse" ? (
        <BrowseView
          games={browseGames}
          pagination={pagination}
          loading={loading}
          search={debouncedSearch}
          sort={sort}
          onSale={onSale}
          page={page}
          onSortChange={setSort}
          onSaleChange={setOnSale}
          onPageChange={setPage}
          onBack={() => {
            setSearch("");
            setDebouncedSearch("");
            setViewMode("home");
          }}
        />
      ) : (
        <LoadingSkeleton />
      )}
    </div>
  );
}

function HomeView({
  featured,
  onBrowse,
}: {
  featured: FeaturedData;
  onBrowse: (sort: string, onSale: boolean) => void;
}) {
  return (
    <div className="space-y-12">
      {/* Quick Access Buttons */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => onBrowse("popular", false)}
          className="rounded-xl border border-border bg-card p-4 text-left hover:border-accent/50 hover:bg-card-hover transition-all group"
        >
          <span className="text-2xl mb-2 block">🔥</span>
          <span className="text-sm font-medium group-hover:text-accent transition-colors">
            Most Popular
          </span>
          <p className="text-xs text-muted mt-0.5">By player ratings</p>
        </button>
        <button
          onClick={() => onBrowse("discount", true)}
          className="rounded-xl border border-border bg-card p-4 text-left hover:border-accent/50 hover:bg-card-hover transition-all group"
        >
          <span className="text-2xl mb-2 block">💰</span>
          <span className="text-sm font-medium group-hover:text-accent transition-colors">
            Best Deals
          </span>
          <p className="text-xs text-muted mt-0.5">Biggest discounts</p>
        </button>
        <button
          onClick={() => onBrowse("price_asc", false)}
          className="rounded-xl border border-border bg-card p-4 text-left hover:border-accent/50 hover:bg-card-hover transition-all group"
        >
          <span className="text-2xl mb-2 block">📉</span>
          <span className="text-sm font-medium group-hover:text-accent transition-colors">
            Budget Picks
          </span>
          <p className="text-xs text-muted mt-0.5">Cheapest first</p>
        </button>
        <button
          onClick={() => onBrowse("title", false)}
          className="rounded-xl border border-border bg-card p-4 text-left hover:border-accent/50 hover:bg-card-hover transition-all group"
        >
          <span className="text-2xl mb-2 block">🎮</span>
          <span className="text-sm font-medium group-hover:text-accent transition-colors">
            All Games
          </span>
          <p className="text-xs text-muted mt-0.5">Browse everything</p>
        </button>
      </div>

      {/* Top Rated */}
      {featured.topRated.length > 0 && (
        <GameSection
          title="Top Rated"
          subtitle="Highest rated games on the PS Store"
          games={featured.topRated}
          onSeeAll={() => onBrowse("popular", false)}
        />
      )}

      {/* Best Deals */}
      {featured.bestDeals.length > 0 && (
        <GameSection
          title="Best Deals"
          subtitle="Biggest discounts right now"
          games={featured.bestDeals}
          onSeeAll={() => onBrowse("discount", true)}
        />
      )}

      {/* At Lowest Price */}
      {featured.lowestEver.length > 0 && (
        <GameSection
          title="At Lowest Price"
          subtitle="Currently at their all-time low"
          games={featured.lowestEver}
          onSeeAll={() => onBrowse("price_asc", false)}
        />
      )}

      {/* Recently On Sale */}
      {featured.recentlyOnSale.length > 0 && (
        <GameSection
          title="Recently On Sale"
          subtitle="Latest price drops"
          games={featured.recentlyOnSale}
          onSeeAll={() => onBrowse("newest", true)}
        />
      )}
    </div>
  );
}

function GameSection({
  title,
  subtitle,
  games,
  onSeeAll,
}: {
  title: string;
  subtitle: string;
  games: Game[];
  onSeeAll: () => void;
}) {
  return (
    <section>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        <button
          onClick={onSeeAll}
          className="text-sm text-accent hover:underline whitespace-nowrap"
        >
          See all &rarr;
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {games.map((game, i) => (
          <GameCard key={game.id} {...game} priority={i < 6} />
        ))}
      </div>
    </section>
  );
}

function BrowseView({
  games,
  pagination,
  loading,
  search,
  sort,
  onSale,
  page,
  onSortChange,
  onSaleChange,
  onPageChange,
  onBack,
}: {
  games: Game[];
  pagination: Pagination | null;
  loading: boolean;
  search: string;
  sort: string;
  onSale: boolean;
  page: number;
  onSortChange: (s: string) => void;
  onSaleChange: (v: boolean) => void;
  onPageChange: (p: number) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-muted hover:text-accent mb-4 inline-block"
      >
        &larr; Back to home
      </button>

      {search && (
        <p className="mb-4 text-sm text-muted">
          Results for &ldquo;{search}&rdquo;
          {pagination && ` (${pagination.total.toLocaleString("en-IN")} found)`}
        </p>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="popular">Most Popular</option>
          <option value="title">Name A-Z</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="discount">Biggest Discount</option>
          <option value="newest">Recently Added</option>
        </select>
        <button
          onClick={() => onSaleChange(!onSale)}
          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
            onSale
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-card text-muted hover:text-foreground"
          }`}
        >
          On Sale
        </button>
        {pagination && (
          <span className="ml-auto text-sm text-muted">
            {pagination.total.toLocaleString("en-IN")} games
          </span>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-xl text-muted mb-2">No games found</p>
          <p className="text-sm text-muted">
            Try a different search or filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {games.map((game, i) => (
            <GameCard key={game.id} {...game} priority={i < 6} />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm disabled:opacity-30 hover:bg-card-hover transition-colors"
          >
            &larr; Prev
          </button>
          {generatePageNumbers(page, pagination.totalPages).map((p, i) =>
            p === -1 ? (
              <span key={`dot-${i}`} className="px-2 text-muted">
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
                  p === page
                    ? "bg-accent text-background font-medium"
                    : "border border-border bg-card hover:bg-card-hover"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() =>
              onPageChange(Math.min(pagination.totalPages, page + 1))
            }
            disabled={page === pagination.totalPages}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm disabled:opacity-30 hover:bg-card-hover transition-colors"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-border bg-card overflow-hidden"
        >
          <div className="aspect-square bg-border/20" />
          <div className="p-3 space-y-2">
            <div className="h-4 w-3/4 rounded bg-border/20" />
            <div className="h-5 w-1/2 rounded bg-border/20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: number[] = [1];
  if (current > 3) pages.push(-1);
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  )
    pages.push(i);
  if (current < total - 2) pages.push(-1);
  pages.push(total);
  return pages;
}
