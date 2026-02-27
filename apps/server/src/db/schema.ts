import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const guests = sqliteTable("guests", {
  id: text("id").primaryKey(), // UUID
  displayName: text("display_name").notNull(),
  username: text("username").unique(), // Claimed unique username (nullable)
  token: text("token").notNull(), // Persistent auth token
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  goldPlayerId: text("gold_player_id").notNull(),
  redPlayerId: text("red_player_id").notNull(),
  winnerId: text("winner_id"),
  winType: text("win_type"), // ya_mon, big_ya_mon, massive_ya_mon
  pointsWon: integer("points_won"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  type: text("type").notNull(), // 'piece' | 'sfx' | 'music'
  title: text("title").notNull(),
  status: text("status").notNull().default("private"), // 'private' | 'published' | 'removed'
  metadata: text("metadata"), // JSON string
  r2Key: text("r2_key"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const assetReports = sqliteTable("asset_reports", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  reporterId: text("reporter_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: integer("created_at").notNull(),
});
