import {
  pgTable,
  text,
  integer,
  bigint,
  timestamp,
  real,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const storeEnum = pgEnum("store", ["psn", "amazon", "flipkart"]);
export const alertTypeEnum = pgEnum("alert_type", ["drop", "any_change"]);

export const games = pgTable(
  "games",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull(),
    store: storeEnum("store").notNull().default("psn"),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    platform: text("platform").default("PS5"),
    category: text("category"),
    currentPrice: real("current_price"),
    originalPrice: real("original_price"),
    lowestPrice: real("lowest_price"),
    highestPrice: real("highest_price"),
    discountPercent: integer("discount_percent"),
    isOnSale: boolean("is_on_sale").default(false),
    url: text("url"),
    description: text("description"),
    publisher: text("publisher"),
    releaseDate: text("release_date"),
    genres: text("genres"),
    fileSize: bigint("file_size", { mode: "number" }),
    ratingScore: real("rating_score"),
    ratingCount: integer("rating_count"),
    screenshots: text("screenshots"),
    numberOfPlayers: text("number_of_players"),
    platpricesUrl: text("platprices_url"),
    platpricesChecked: boolean("platprices_checked").default(false),
    metadataFetched: boolean("metadata_fetched").default(false),
    lastChecked: timestamp("last_checked"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_games_store").on(table.store),
    index("idx_games_on_sale").on(table.isOnSale),
    index("idx_games_current_price").on(table.currentPrice),
    uniqueIndex("idx_games_store_id").on(table.store, table.storeId),
  ]
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    price: real("price").notNull(),
    originalPrice: real("original_price"),
    discountPercent: integer("discount_percent"),
    source: text("source").default("psn"),
    recordedAt: timestamp("recorded_at").defaultNow(),
  },
  (table) => [
    index("idx_price_history_game").on(table.gameId),
    index("idx_price_history_date").on(table.recordedAt),
  ]
);

export const alerts = pgTable(
  "alerts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    telegramChatId: text("telegram_chat_id").notNull(),
    alertType: alertTypeEnum("alert_type").notNull().default("drop"),
    targetPrice: real("target_price"),
    isActive: boolean("is_active").default(true),
    lastNotified: timestamp("last_notified"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_alerts_game").on(table.gameId),
    index("idx_alerts_active").on(table.isActive),
  ]
);
