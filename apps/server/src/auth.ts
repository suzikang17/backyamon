import { randomUUID, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { guests } from "./db/schema.js";

const ADJECTIVES = [
  "Cool",
  "Irie",
  "Zion",
  "Dub",
  "Reggae",
  "Roots",
  "Bass",
  "Ska",
  "Rasta",
  "Dread",
  "Mystic",
  "Island",
  "Trench",
  "Nyah",
  "Jah",
  "Blazing",
  "Mellow",
  "Royal",
  "Rebel",
  "Steppin",
  "Riddim",
  "Chill",
  "Wicked",
  "Massive",
  "Yard",
];

const NOUNS = [
  "Selector",
  "Vibes",
  "Lion",
  "Master",
  "King",
  "Rider",
  "Bomber",
  "Skater",
  "Warrior",
  "Prophet",
  "Runner",
  "Dreamer",
  "Shaker",
  "Roller",
  "Stepper",
  "Chanter",
  "Rocker",
  "Spinner",
  "Breaker",
  "Blazer",
  "Ruler",
  "Healer",
  "Player",
  "Shaman",
  "Elder",
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDisplayName(): string {
  return randomElement(ADJECTIVES) + randomElement(NOUNS);
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export interface GuestAccount {
  id: string;
  displayName: string;
  username: string | null;
  token: string;
}

export async function createGuest(): Promise<GuestAccount> {
  const id = randomUUID();
  const displayName = generateDisplayName();
  const token = generateToken();
  const now = new Date();

  await db.insert(guests)
    .values({
      id,
      displayName,
      token,
      createdAt: now,
    })
    .run();

  return { id, displayName, username: null, token };
}

export async function lookupByToken(token: string): Promise<GuestAccount | null> {
  const row = await db.select().from(guests).where(eq(guests.token, token)).get();
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.displayName,
    username: row.username,
    token: row.token,
  };
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const row = await db
    .select({ id: guests.id })
    .from(guests)
    .where(eq(guests.username, username))
    .get();
  return !!row;
}

export async function claimUsername(
  playerId: string,
  username: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate username format
  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return { ok: false, error: "Username must be 2-20 characters." };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      ok: false,
      error: "Username can only contain letters, numbers, hyphens, and underscores.",
    };
  }

  if (await isUsernameTaken(trimmed)) {
    return { ok: false, error: "Username is already taken." };
  }

  await db.update(guests)
    .set({ username: trimmed, displayName: trimmed })
    .where(eq(guests.id, playerId))
    .run();

  return { ok: true };
}
