export interface ScrapedGame {
  storeId: string;
  title: string;
  currentPrice: number | null;
  originalPrice: number | null;
  discountPercent: number | null;
  imageUrl: string | null;
  platform: string;
  category: string | null;
  url: string;
  isOnSale: boolean;
}

export interface StoreScraper {
  readonly storeName: string;
  scrapeAll(): Promise<ScrapedGame[]>;
}
