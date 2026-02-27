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

/**
 * Sign in as a username — arcade style, no ownership.
 * If the username already exists, switch to that guest row.
 * If not, set it on the current guest row.
 * Returns the guest account to use going forward.
 */
export async function signInAs(
  currentGuestId: string,
  username: string
): Promise<{ ok: true; guest: GuestAccount } | { ok: false; error: string }> {
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

  // Check if this username already exists
  const existing = await db.select().from(guests).where(eq(guests.username, trimmed)).get();

  if (existing) {
    // Switch to the existing profile — copy our token so this browser remembers it
    const current = await db.select().from(guests).where(eq(guests.id, currentGuestId)).get();
    const token = current?.token || existing.token;
    await db.update(guests).set({ token }).where(eq(guests.id, existing.id)).run();
    return {
      ok: true,
      guest: { id: existing.id, displayName: trimmed, username: trimmed, token },
    };
  }

  // Username is new — set it on the current guest row
  await db.update(guests)
    .set({ username: trimmed, displayName: trimmed })
    .where(eq(guests.id, currentGuestId))
    .run();

  const updated = await db.select().from(guests).where(eq(guests.id, currentGuestId)).get();
  return {
    ok: true,
    guest: {
      id: currentGuestId,
      displayName: trimmed,
      username: trimmed,
      token: updated?.token || "",
    },
  };
}
