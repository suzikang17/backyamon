import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const DB_PATH = process.env.DB_PATH || "backyamon.db";

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
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
`);

export const db = drizzle(sqlite, { schema });
