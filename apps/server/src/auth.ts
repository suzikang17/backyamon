import { randomUUID } from "node:crypto";
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

export interface GuestAccount {
  id: string;
  displayName: string;
}

export function createGuest(): GuestAccount {
  const id = randomUUID();
  const displayName = generateDisplayName();
  const now = new Date();

  db.insert(guests)
    .values({
      id,
      displayName,
      createdAt: now,
    })
    .run();

  return { id, displayName };
}
