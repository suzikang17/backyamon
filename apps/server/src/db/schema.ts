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
