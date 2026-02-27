import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:backyamon.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

// Initialize tables — must be called before the server starts accepting connections
export async function initDatabase(): Promise<void> {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      username TEXT UNIQUE,
      token TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      gold_player_id TEXT NOT NULL,
      red_player_id TEXT NOT NULL,
      winner_id TEXT,
      win_type TEXT,
      points_won INTEGER,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'private',
      metadata TEXT,
      r2_key TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asset_reports (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      reporter_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}
