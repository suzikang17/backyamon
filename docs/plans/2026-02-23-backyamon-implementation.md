# Backyamon MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a playable Rastafarian-themed backgammon web game with AI opponents, online multiplayer, reactive reggae soundtrack, and themed visuals.

**Architecture:** Monorepo with three packages: a pure TypeScript game engine (`@backyamon/engine`), a Next.js frontend (`@backyamon/web`), and a Node.js multiplayer server (`@backyamon/server`). The engine is shared between client and server for move validation. PixiJS renders the game board, Howler.js handles audio, Socket.io handles real-time multiplayer.

**Tech Stack:** TypeScript, Next.js 14+ (App Router), PixiJS 8, Howler.js, Socket.io, Drizzle ORM + SQLite, Vitest for testing.

**Design Doc:** `docs/plans/2026-02-23-backyamon-design.md`

---

## Project Structure

```
backyamon/
├── package.json                    # Workspace root
├── turbo.json                      # Turborepo config
├── packages/
│   └── engine/                     # @backyamon/engine - pure TS, no UI deps
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── index.ts            # Public API barrel export
│           ├── types.ts            # GameState, Move, Turn, etc.
│           ├── constants.ts        # Board layout, initial positions
│           ├── state.ts            # createInitialState, cloneState
│           ├── dice.ts             # rollDice, getDiceValues
│           ├── moves.ts            # getLegalMoves, applyMove
│           ├── bearing-off.ts      # canBearOff, getBearOffMoves
│           ├── winner.ts           # checkWinner, getWinType
│           ├── doubling.ts         # offerDouble, acceptDouble, declineDouble
│           └── ai/
│               ├── types.ts        # AIPlayer interface
│               ├── beach-bum.ts    # Easy AI - random
│               ├── selector.ts     # Medium AI - heuristic
│               └── king-tubby.ts   # Hard AI - minimax
├── apps/
│   ├── web/                        # @backyamon/web - Next.js frontend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── public/
│   │   │   ├── audio/              # Music stems, SFX, voice clips
│   │   │   └── sprites/            # Board, pieces, dice sprite sheets
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx      # Root layout, fonts, theme
│   │       │   ├── page.tsx        # Main menu / landing
│   │       │   ├── play/
│   │       │   │   └── page.tsx    # Game page (hosts PixiJS canvas)
│   │       │   └── lobby/
│   │       │       └── page.tsx    # Online multiplayer lobby
│   │       ├── game/
│   │       │   ├── BoardRenderer.ts    # PixiJS board rendering
│   │       │   ├── PieceRenderer.ts    # PixiJS piece rendering + animation
│   │       │   ├── DiceRenderer.ts     # PixiJS dice rendering + animation
│   │       │   ├── GameController.ts   # Orchestrates engine + renderer + audio
│   │       │   └── InputHandler.ts     # Drag-and-drop, click-to-move
│   │       ├── audio/
│   │       │   └── SoundManager.ts     # Howler.js wrapper, reactive stems
│   │       ├── multiplayer/
│   │       │   └── SocketClient.ts     # Socket.io client wrapper
│   │       ├── components/
│   │       │   ├── GameCanvas.tsx       # React wrapper for PixiJS
│   │       │   ├── MainMenu.tsx
│   │       │   ├── GameHUD.tsx         # Doubling cube, timer, score
│   │       │   ├── DifficultySelect.tsx
│   │       │   └── LobbyUI.tsx
│   │       └── lib/
│   │           ├── theme.ts            # Rasta color palette, fonts
│   │           └── utils.ts
│   └── server/                     # @backyamon/server - multiplayer
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # Server entry point
│           ├── rooms.ts            # Game room management
│           ├── matchmaking.ts      # Quick match, private rooms
│           ├── auth.ts             # Guest account generation
│           └── db/
│               ├── schema.ts       # Drizzle schema
│               └── index.ts        # DB connection
└── docs/plans/
```

---

## Task 1: Project Scaffolding & Monorepo Setup

**Files:**
- Create: `package.json` (workspace root)
- Create: `turbo.json`
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `packages/engine/vitest.config.ts`
- Create: `packages/engine/src/index.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`
- Create: `.gitignore`

**Step 1: Create root package.json with workspaces**

```json
{
  "name": "backyamon",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.5"
  }
}
```

**Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

**Step 3: Create engine package**

`packages/engine/package.json`:
```json
{
  "name": "@backyamon/engine",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "vitest": "^3"
  }
}
```

`packages/engine/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`packages/engine/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { globals: true },
});
```

`packages/engine/src/index.ts`: empty barrel export (populated as we build).

**Step 4: Create Next.js web app**

`apps/web/package.json`:
```json
{
  "name": "@backyamon/web",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "pixi.js": "^8",
    "howler": "^2.2",
    "socket.io-client": "^4",
    "@backyamon/engine": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/howler": "^2",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "postcss": "^8"
  }
}
```

Create minimal `apps/web/src/app/layout.tsx` and `apps/web/src/app/page.tsx` (placeholder "Backyamon" heading).

**Step 5: Create server package**

`apps/server/package.json`:
```json
{
  "name": "@backyamon/server",
  "version": "0.1.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "socket.io": "^4",
    "drizzle-orm": "^0.38",
    "better-sqlite3": "^11",
    "@backyamon/engine": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4",
    "drizzle-kit": "^0.30",
    "@types/better-sqlite3": "^7"
  }
}
```

`apps/server/src/index.ts`: minimal Socket.io server on port 3001.

**Step 6: Create .gitignore**

```
node_modules/
dist/
.next/
.turbo/
*.db
.env
.env.local
```

**Step 7: Install deps & verify**

Run: `npm install`
Run: `npx turbo build` — verify all three packages build without errors.

**Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold monorepo with engine, web, and server packages"
```

---

## Task 2: Engine - Core Types & Initial State

**Files:**
- Create: `packages/engine/src/types.ts`
- Create: `packages/engine/src/constants.ts`
- Create: `packages/engine/src/state.ts`
- Test: `packages/engine/src/__tests__/state.test.ts`

**Step 1: Write the failing test**

`packages/engine/src/__tests__/state.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "../state";
import { Player } from "../types";

describe("createInitialState", () => {
  it("should set up the board with standard backgammon positions", () => {
    const state = createInitialState();

    // Point 1 (index 0): 2 white pieces
    expect(state.points[0]).toEqual({ player: Player.Gold, count: 2 });
    // Point 6 (index 5): 5 red pieces
    expect(state.points[5]).toEqual({ player: Player.Red, count: 5 });
    // Point 8 (index 7): 3 red pieces
    expect(state.points[7]).toEqual({ player: Player.Red, count: 3 });
    // Point 12 (index 11): 5 white pieces
    expect(state.points[11]).toEqual({ player: Player.Gold, count: 5 });
    // Point 13 (index 12): 5 red pieces
    expect(state.points[12]).toEqual({ player: Player.Red, count: 5 });
    // Point 17 (index 16): 3 white pieces
    expect(state.points[16]).toEqual({ player: Player.Gold, count: 3 });
    // Point 19 (index 18): 5 white pieces
    expect(state.points[18]).toEqual({ player: Player.Gold, count: 5 });
    // Point 24 (index 23): 2 red pieces
    expect(state.points[23]).toEqual({ player: Player.Red, count: 2 });

    // Empty points should be null
    expect(state.points[1]).toBeNull();

    // Bar and borne off should be empty
    expect(state.bar[Player.Gold]).toBe(0);
    expect(state.bar[Player.Red]).toBe(0);
    expect(state.borneOff[Player.Gold]).toBe(0);
    expect(state.borneOff[Player.Red]).toBe(0);

    // Game should start in ROLLING phase
    expect(state.phase).toBe("ROLLING");
    expect(state.currentPlayer).toBe(Player.Gold);
    expect(state.doublingCube).toEqual({ value: 1, owner: null });
  });

  it("should have 15 pieces per player", () => {
    const state = createInitialState();
    let goldCount = 0;
    let redCount = 0;
    for (const point of state.points) {
      if (point?.player === Player.Gold) goldCount += point.count;
      if (point?.player === Player.Red) redCount += point.count;
    }
    expect(goldCount).toBe(15);
    expect(redCount).toBe(15);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && npx vitest run src/__tests__/state.test.ts`
Expected: FAIL — modules don't exist yet.

**Step 3: Implement types.ts**

```ts
export enum Player {
  Gold = "gold",
  Red = "red",
}

export type PointState = {
  player: Player;
  count: number;
} | null;

export type GamePhase = "ROLLING" | "MOVING" | "CHECKING_WIN" | "GAME_OVER";

export type WinType = "ya_mon" | "big_ya_mon" | "massive_ya_mon";

export interface DoublingCube {
  value: number; // 1, 2, 4, 8, 16, ...
  owner: Player | null; // null = centered (either can double)
}

export interface Dice {
  values: [number, number];
  remaining: number[]; // Dice values not yet used this turn
}

export interface Move {
  from: number | "bar"; // Point index (0-23) or "bar"
  to: number | "off"; // Point index (0-23) or "off" (bear off)
}

export interface GameState {
  points: PointState[]; // 24 points, index 0 = point 1
  bar: Record<Player, number>;
  borneOff: Record<Player, number>;
  currentPlayer: Player;
  phase: GamePhase;
  dice: Dice | null;
  doublingCube: DoublingCube;
  matchScore: Record<Player, number>;
  matchLength: number; // Points to win the match
  isCrawford: boolean;
  winner: Player | null;
  winType: WinType | null;
}
```

**Step 4: Implement constants.ts**

```ts
import { Player, type PointState } from "./types";

// Standard backgammon starting positions
// Index = point number - 1 (0-indexed)
// Gold moves from point 1 -> 24 (index 0 -> 23)
// Red moves from point 24 -> 1 (index 23 -> 0)
export const INITIAL_POSITIONS: PointState[] = Array.from(
  { length: 24 },
  (): PointState => null
);

// Gold pieces (moving toward point 24)
// Point 1 (idx 0): 2, Point 12 (idx 11): 5, Point 17 (idx 16): 3, Point 19 (idx 18): 5
INITIAL_POSITIONS[0] = { player: Player.Gold, count: 2 };
INITIAL_POSITIONS[11] = { player: Player.Gold, count: 5 };
INITIAL_POSITIONS[16] = { player: Player.Gold, count: 3 };
INITIAL_POSITIONS[18] = { player: Player.Gold, count: 5 };

// Red pieces (moving toward point 1)
// Point 24 (idx 23): 2, Point 13 (idx 12): 5, Point 8 (idx 7): 3, Point 6 (idx 5): 5
INITIAL_POSITIONS[23] = { player: Player.Red, count: 2 };
INITIAL_POSITIONS[12] = { player: Player.Red, count: 5 };
INITIAL_POSITIONS[7] = { player: Player.Red, count: 3 };
INITIAL_POSITIONS[5] = { player: Player.Red, count: 5 };

export const PIECES_PER_PLAYER = 15;
export const POINTS_COUNT = 24;
export const HOME_BOARD_START = { [Player.Gold]: 18, [Player.Red]: 0 }; // Index of home board start
export const HOME_BOARD_END = { [Player.Gold]: 23, [Player.Red]: 5 }; // Index of home board end
export const MOVE_DIRECTION = { [Player.Gold]: 1, [Player.Red]: -1 }; // +1 = ascending, -1 = descending
```

**Step 5: Implement state.ts**

```ts
import { Player, type GameState } from "./types";
import { INITIAL_POSITIONS } from "./constants";

export function createInitialState(matchLength = 1): GameState {
  return {
    points: INITIAL_POSITIONS.map((p) => (p ? { ...p } : null)),
    bar: { [Player.Gold]: 0, [Player.Red]: 0 } as Record<Player, number>,
    borneOff: { [Player.Gold]: 0, [Player.Red]: 0 } as Record<Player, number>,
    currentPlayer: Player.Gold,
    phase: "ROLLING",
    dice: null,
    doublingCube: { value: 1, owner: null },
    matchScore: { [Player.Gold]: 0, [Player.Red]: 0 } as Record<Player, number>,
    matchLength,
    isCrawford: false,
    winner: null,
    winType: null,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    points: state.points.map((p) => (p ? { ...p } : null)),
    bar: { ...state.bar },
    borneOff: { ...state.borneOff },
    dice: state.dice
      ? { ...state.dice, remaining: [...state.dice.remaining] }
      : null,
    doublingCube: { ...state.doublingCube },
    matchScore: { ...state.matchScore },
  };
}
```

**Step 6: Update index.ts barrel export**

```ts
export * from "./types";
export * from "./constants";
export * from "./state";
```

**Step 7: Run test to verify it passes**

Run: `cd packages/engine && npx vitest run src/__tests__/state.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/engine/src/ && git commit -m "feat(engine): add core types and initial board state"
```

---

## Task 3: Engine - Dice & Move Generation

**Files:**
- Create: `packages/engine/src/dice.ts`
- Create: `packages/engine/src/moves.ts`
- Test: `packages/engine/src/__tests__/dice.test.ts`
- Test: `packages/engine/src/__tests__/moves.test.ts`

**Step 1: Write dice tests**

`packages/engine/src/__tests__/dice.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { rollDice, getDiceMoveCounts } from "../dice";

describe("rollDice", () => {
  it("should return two values between 1 and 6", () => {
    for (let i = 0; i < 100; i++) {
      const dice = rollDice();
      expect(dice.values).toHaveLength(2);
      expect(dice.values[0]).toBeGreaterThanOrEqual(1);
      expect(dice.values[0]).toBeLessThanOrEqual(6);
      expect(dice.values[1]).toBeGreaterThanOrEqual(1);
      expect(dice.values[1]).toBeLessThanOrEqual(6);
    }
  });

  it("should double the remaining moves on doubles", () => {
    const dice = rollDice([3, 3]);
    expect(dice.remaining).toEqual([3, 3, 3, 3]);
  });

  it("should have two remaining moves for non-doubles", () => {
    const dice = rollDice([4, 2]);
    expect(dice.remaining).toEqual([4, 2]);
  });
});

describe("getDiceMoveCounts", () => {
  it("should return both values for non-doubles", () => {
    expect(getDiceMoveCounts([3, 5])).toEqual([3, 5]);
  });

  it("should return four of the same for doubles", () => {
    expect(getDiceMoveCounts([6, 6])).toEqual([6, 6, 6, 6]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && npx vitest run src/__tests__/dice.test.ts`

**Step 3: Implement dice.ts**

```ts
import type { Dice } from "./types";

export function rollDice(forced?: [number, number]): Dice {
  const values: [number, number] = forced ?? [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
  const remaining = getDiceMoveCounts(values);
  return { values, remaining };
}

export function getDiceMoveCounts(values: [number, number]): number[] {
  if (values[0] === values[1]) {
    return [values[0], values[0], values[0], values[0]];
  }
  return [values[0], values[1]];
}
```

**Step 4: Run dice tests — verify PASS**

**Step 5: Write move generation tests**

`packages/engine/src/__tests__/moves.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getLegalMoves, applyMove } from "../moves";
import { createInitialState } from "../state";
import { Player } from "../types";
import { rollDice } from "../dice";

describe("getLegalMoves", () => {
  it("should return moves for opening position", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    const moves = getLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it("should only allow bar entry when player has pieces on bar", () => {
    const state = createInitialState();
    state.bar[Player.Gold] = 1;
    state.points[0]!.count = 1; // Remove one piece from point 1
    state.dice = rollDice([3, 1]);
    const moves = getLegalMoves(state);
    // All moves must start from "bar"
    expect(moves.every((m) => m.from === "bar")).toBe(true);
  });

  it("should return empty array when no legal moves exist", () => {
    const state = createInitialState();
    state.bar[Player.Gold] = 1;
    // Block all entry points for a roll of [6, 5]
    state.dice = rollDice([6, 5]);
    // Fill points 5 and 6 with 2+ opponent pieces
    state.points[4] = { player: Player.Red, count: 2 };
    state.points[5] = { player: Player.Red, count: 2 };
    const moves = getLegalMoves(state);
    expect(moves).toEqual([]);
  });
});

describe("applyMove", () => {
  it("should move a piece from one point to another", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    // Move gold piece from point 1 (idx 0) by 3 to point 4 (idx 3)
    const newState = applyMove(state, { from: 0, to: 3 });
    expect(newState.points[0]!.count).toBe(1); // Was 2, now 1
    expect(newState.points[3]).toEqual({ player: Player.Gold, count: 1 });
  });

  it("should hit an opponent blot and send it to the bar", () => {
    const state = createInitialState();
    state.dice = rollDice([4, 1]);
    state.phase = "MOVING";
    // Place a red blot on point 5 (idx 4)
    state.points[4] = { player: Player.Red, count: 1 };
    // Move gold from point 1 (idx 0) to point 5 (idx 4)
    const newState = applyMove(state, { from: 0, to: 4 });
    expect(newState.points[4]).toEqual({ player: Player.Gold, count: 1 });
    expect(newState.bar[Player.Red]).toBe(1);
  });

  it("should enter a piece from the bar", () => {
    const state = createInitialState();
    state.bar[Player.Gold] = 1;
    state.points[0]!.count = 1;
    state.dice = rollDice([1, 3]);
    state.phase = "MOVING";
    const newState = applyMove(state, { from: "bar", to: 0 });
    expect(newState.bar[Player.Gold]).toBe(0);
    expect(newState.points[0]!.count).toBe(2);
  });

  it("should not mutate the original state", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const originalCount = state.points[0]!.count;
    applyMove(state, { from: 0, to: 3 });
    expect(state.points[0]!.count).toBe(originalCount);
  });
});
```

**Step 6: Implement moves.ts**

This is the most complex module. Key logic:

```ts
import { Player, type GameState, type Move, type PointState } from "./types";
import { MOVE_DIRECTION, POINTS_COUNT } from "./constants";
import { cloneState } from "./state";

function opponent(player: Player): Player {
  return player === Player.Gold ? Player.Red : Player.Gold;
}

function getTargetIndex(from: number | "bar", dieValue: number, player: Player): number {
  if (from === "bar") {
    return player === Player.Gold ? dieValue - 1 : POINTS_COUNT - dieValue;
  }
  return from + dieValue * MOVE_DIRECTION[player];
}

function isPointOpen(point: PointState, player: Player): boolean {
  if (point === null) return true;
  if (point.player === player) return true;
  if (point.count <= 1) return true; // Blot — can hit
  return false;
}

export function getLegalMoves(state: GameState): Move[] {
  const { currentPlayer, dice } = state;
  if (!dice || dice.remaining.length === 0) return [];

  const moves: Move[] = [];
  const hasBar = state.bar[currentPlayer] > 0;

  // Unique remaining dice values to avoid duplicate moves
  const uniqueDice = [...new Set(dice.remaining)];

  for (const die of uniqueDice) {
    if (hasBar) {
      // Must enter from bar first
      const target = getTargetIndex("bar", die, currentPlayer);
      if (target >= 0 && target < POINTS_COUNT && isPointOpen(state.points[target], currentPlayer)) {
        moves.push({ from: "bar", to: target });
      }
    } else {
      // Move pieces from points
      for (let i = 0; i < POINTS_COUNT; i++) {
        const point = state.points[i];
        if (point && point.player === currentPlayer) {
          const target = getTargetIndex(i, die, currentPlayer);
          if (target >= 0 && target < POINTS_COUNT && isPointOpen(state.points[target], currentPlayer)) {
            moves.push({ from: i, to: target });
          }
        }
      }
      // Bearing off moves checked separately (see Task 5)
    }
  }

  return moves;
}

export function applyMove(state: GameState, move: Move): GameState {
  const newState = cloneState(state);
  const { currentPlayer } = newState;
  const opp = opponent(currentPlayer);

  // Remove piece from source
  if (move.from === "bar") {
    newState.bar[currentPlayer]--;
  } else {
    const fromPoint = newState.points[move.from]!;
    fromPoint.count--;
    if (fromPoint.count === 0) {
      newState.points[move.from] = null;
    }
  }

  // Place piece on target
  if (move.to === "off") {
    newState.borneOff[currentPlayer]++;
  } else {
    const toPoint = newState.points[move.to];
    if (toPoint && toPoint.player === opp) {
      // Hit opponent blot
      newState.bar[opp]++;
      newState.points[move.to] = { player: currentPlayer, count: 1 };
    } else if (toPoint && toPoint.player === currentPlayer) {
      toPoint.count++;
    } else {
      newState.points[move.to] = { player: currentPlayer, count: 1 };
    }
  }

  // Consume the die used
  if (move.to !== "off" && move.from !== "bar") {
    const distance = Math.abs(move.to - (move.from as number));
    const dieIdx = newState.dice!.remaining.indexOf(distance);
    if (dieIdx !== -1) newState.dice!.remaining.splice(dieIdx, 1);
  } else if (move.from === "bar") {
    const die =
      currentPlayer === Player.Gold
        ? (move.to as number) + 1
        : POINTS_COUNT - (move.to as number);
    const dieIdx = newState.dice!.remaining.indexOf(die);
    if (dieIdx !== -1) newState.dice!.remaining.splice(dieIdx, 1);
  }

  return newState;
}
```

**Note:** Bearing off die consumption handled in Task 5. This covers the core move/hit/bar-entry logic.

**Step 7: Run tests — verify PASS**

Run: `cd packages/engine && npx vitest run`

**Step 8: Update index.ts exports**

Add: `export * from "./dice"` and `export * from "./moves"`

**Step 9: Commit**

```bash
git add packages/engine/src/ && git commit -m "feat(engine): add dice rolling and move generation/application"
```

---

## Task 4: Engine - Bearing Off

**Files:**
- Create: `packages/engine/src/bearing-off.ts`
- Test: `packages/engine/src/__tests__/bearing-off.test.ts`
- Modify: `packages/engine/src/moves.ts` (integrate bearing off into getLegalMoves)

**Step 1: Write bearing off tests**

```ts
import { describe, it, expect } from "vitest";
import { canBearOff, getBearOffMoves } from "../bearing-off";
import { createInitialState } from "../state";
import { Player } from "../types";

describe("canBearOff", () => {
  it("should return false at game start", () => {
    const state = createInitialState();
    expect(canBearOff(state, Player.Gold)).toBe(false);
  });

  it("should return true when all pieces are in home board", () => {
    const state = createInitialState();
    // Clear board and put all Gold pieces in home board (points 19-24, idx 18-23)
    state.points = state.points.map(() => null);
    state.points[18] = { player: Player.Gold, count: 5 };
    state.points[19] = { player: Player.Gold, count: 5 };
    state.points[20] = { player: Player.Gold, count: 5 };
    expect(canBearOff(state, Player.Gold)).toBe(true);
  });

  it("should return false if a piece is on the bar", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[18] = { player: Player.Gold, count: 14 };
    state.bar[Player.Gold] = 1;
    expect(canBearOff(state, Player.Gold)).toBe(false);
  });
});

describe("getBearOffMoves", () => {
  it("should allow exact bear off", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[23] = { player: Player.Gold, count: 1 }; // Point 24
    const moves = getBearOffMoves(state, Player.Gold, 1);
    expect(moves).toContainEqual({ from: 23, to: "off" });
  });

  it("should allow higher die to bear off farthest piece", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[20] = { player: Player.Gold, count: 1 }; // Point 21 (needs 4 to bear off)
    // Rolling a 6 should allow bearing off from point 21 if no piece is farther back
    const moves = getBearOffMoves(state, Player.Gold, 6);
    expect(moves).toContainEqual({ from: 20, to: "off" });
  });

  it("should NOT allow higher die to bear off if a piece is farther back", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[18] = { player: Player.Gold, count: 1 }; // Point 19 — farther back
    state.points[22] = { player: Player.Gold, count: 1 }; // Point 23
    // Rolling a 2: can bear off from 23 (exact), but cannot bear off from 19 with a 2
    // Also cannot use the "higher die" exception on 23 because 19 is farther back
    const moves = getBearOffMoves(state, Player.Gold, 2);
    expect(moves).toContainEqual({ from: 22, to: "off" }); // Exact
    expect(moves).not.toContainEqual({ from: 18, to: "off" }); // Too far back
  });
});
```

**Step 2: Implement bearing-off.ts**

Key rules:
- Can only bear off when ALL player's pieces are in their home board (and none on bar)
- Exact die value bears off the piece
- Higher die can bear off the farthest-back piece if no piece is farther from bearing off
- Otherwise, higher die must be used to move within home board

**Step 3: Integrate into getLegalMoves in moves.ts** — add bearing off moves when `canBearOff` returns true.

**Step 4: Run all tests — verify PASS**

**Step 5: Commit**

```bash
git add packages/engine/src/ && git commit -m "feat(engine): add bearing off logic"
```

---

## Task 5: Engine - Win Detection & Scoring

**Files:**
- Create: `packages/engine/src/winner.ts`
- Test: `packages/engine/src/__tests__/winner.test.ts`

**Step 1: Write win detection tests**

```ts
import { describe, it, expect } from "vitest";
import { checkWinner, getWinType } from "../winner";
import { createInitialState } from "../state";
import { Player } from "../types";

describe("checkWinner", () => {
  it("should return null when no one has won", () => {
    const state = createInitialState();
    expect(checkWinner(state)).toBeNull();
  });

  it("should detect Gold win when all 15 pieces borne off", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    expect(checkWinner(state)).toBe(Player.Gold);
  });
});

describe("getWinType", () => {
  it('should return "ya_mon" for normal win', () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    state.borneOff[Player.Red] = 3; // Red has borne off some
    expect(getWinType(state, Player.Gold)).toBe("ya_mon");
  });

  it('should return "big_ya_mon" for gammon', () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    state.borneOff[Player.Red] = 0; // Red has borne off NONE
    state.points[12] = { player: Player.Red, count: 15 }; // All red still on board, not in winner's home
    expect(getWinType(state, Player.Gold)).toBe("big_ya_mon");
  });

  it('should return "massive_ya_mon" for backgammon', () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    state.borneOff[Player.Red] = 0;
    // Red has piece on bar or in Gold's home board
    state.bar[Player.Red] = 2;
    state.points[20] = { player: Player.Red, count: 13 }; // In Gold's home board
    expect(getWinType(state, Player.Gold)).toBe("massive_ya_mon");
  });
});
```

**Step 2: Implement winner.ts**

```ts
import { Player, type GameState, type WinType } from "./types";
import { PIECES_PER_PLAYER, HOME_BOARD_START, HOME_BOARD_END } from "./constants";

export function checkWinner(state: GameState): Player | null {
  if (state.borneOff[Player.Gold] === PIECES_PER_PLAYER) return Player.Gold;
  if (state.borneOff[Player.Red] === PIECES_PER_PLAYER) return Player.Red;
  return null;
}

export function getWinType(state: GameState, winner: Player): WinType {
  const loser = winner === Player.Gold ? Player.Red : Player.Gold;

  // Has loser borne off any pieces?
  if (state.borneOff[loser] > 0) return "ya_mon";

  // Backgammon: loser has pieces on bar or in winner's home board
  if (state.bar[loser] > 0) return "massive_ya_mon";

  const winnerHomeStart = HOME_BOARD_START[winner];
  const winnerHomeEnd = HOME_BOARD_END[winner];
  for (let i = Math.min(winnerHomeStart, winnerHomeEnd); i <= Math.max(winnerHomeStart, winnerHomeEnd); i++) {
    const point = state.points[i];
    if (point && point.player === loser) return "massive_ya_mon";
  }

  // Gammon: loser hasn't borne off any pieces
  return "big_ya_mon";
}

export function getPointsWon(winType: WinType, doublingCubeValue: number): number {
  const multiplier = winType === "ya_mon" ? 1 : winType === "big_ya_mon" ? 2 : 3;
  return multiplier * doublingCubeValue;
}
```

**Step 3: Run tests — verify PASS**

**Step 4: Commit**

```bash
git add packages/engine/src/ && git commit -m "feat(engine): add win detection and Ya Mon scoring"
```

---

## Task 6: Engine - Turn Management & Doubling Cube

**Files:**
- Create: `packages/engine/src/turn.ts`
- Create: `packages/engine/src/doubling.ts`
- Test: `packages/engine/src/__tests__/turn.test.ts`
- Test: `packages/engine/src/__tests__/doubling.test.ts`

**Step 1: Write turn management tests**

Cover:
- Switching turns after all dice consumed
- Switching turns when no legal moves (auto-skip)
- Forced move detection (must use both dice if possible; if only one, must use higher)
- Phase transitions: ROLLING -> MOVING -> CHECKING_WIN -> ROLLING (next turn) or GAME_OVER

**Step 2: Write doubling cube tests**

Cover:
- Offering a double (only before rolling, only by cube owner or when centered)
- Accepting a double (cube value doubles, ownership transfers)
- Declining a double (opponent wins at current stake)
- Crawford rule (no doubling in Crawford game)

**Step 3: Implement turn.ts**

Key function: `endTurn(state)` — checks for winner, switches player, resets to ROLLING phase.
Key function: `getAllLegalTurns(state)` — returns all possible complete turns (sequences of moves). Needed for forced move validation.

**Step 4: Implement doubling.ts**

```ts
export function canOfferDouble(state: GameState): boolean {
  if (state.phase !== "ROLLING") return false;
  if (state.isCrawford) return false;
  const { owner } = state.doublingCube;
  return owner === null || owner === state.currentPlayer;
}

export function offerDouble(state: GameState): GameState { ... }
export function acceptDouble(state: GameState): GameState { ... }
export function declineDouble(state: GameState): GameState { ... }
```

**Step 5: Run all tests — verify PASS**

**Step 6: Commit**

```bash
git add packages/engine/src/ && git commit -m "feat(engine): add turn management and doubling cube (Turn It Up)"
```

---

## Task 7: Engine - AI Players

**Files:**
- Create: `packages/engine/src/ai/types.ts`
- Create: `packages/engine/src/ai/beach-bum.ts`
- Create: `packages/engine/src/ai/selector.ts`
- Create: `packages/engine/src/ai/king-tubby.ts`
- Test: `packages/engine/src/__tests__/ai.test.ts`

**Step 1: Define AI interface**

```ts
// packages/engine/src/ai/types.ts
import type { GameState, Move } from "../types";

export interface AIPlayer {
  name: string;
  difficulty: "easy" | "medium" | "hard";
  selectMoves(state: GameState): Move[];
  shouldDouble(state: GameState): boolean;
  shouldAcceptDouble(state: GameState): boolean;
}
```

**Step 2: Write AI tests**

```ts
describe("Beach Bum (easy)", () => {
  it("should return legal moves", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const ai = new BeachBum();
    const moves = ai.selectMoves(state);
    expect(moves.length).toBeGreaterThan(0);
    // Each move should be legal
  });
});

describe("Selector (medium)", () => {
  it("should prefer making points over leaving blots", () => { ... });
});

describe("King Tubby (hard)", () => {
  it("should complete within 2 seconds", () => { ... });
});
```

**Step 3: Implement Beach Bum** — picks a random complete legal turn.

**Step 4: Implement Selector** — board evaluation heuristic:
- +10 for each made point (2+ pieces)
- -15 for each blot
- +5 for each piece in home board
- -20 for each piece on bar
- +3 for pip count advantage
- Evaluates all legal turns, picks highest score.

**Step 5: Implement King Tubby** — minimax with alpha-beta pruning:
- Depth 3 (look ahead 3 full turns)
- Uses Selector's evaluation function at leaf nodes
- Considers opponent's best response
- Prunes branches that can't improve the score

**Step 6: Run tests — verify PASS**

**Step 7: Commit**

```bash
git add packages/engine/src/ && git commit -m "feat(engine): add Beach Bum, Selector, and King Tubby AI players"
```

---

## Task 8: Next.js App Shell & Main Menu

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/lib/theme.ts`
- Create: `apps/web/src/components/MainMenu.tsx`
- Create: `apps/web/src/components/DifficultySelect.tsx`
- Create: `apps/web/src/app/play/page.tsx`
- Create: `apps/web/src/app/globals.css`

**Step 1: Define theme constants**

`apps/web/src/lib/theme.ts`:
```ts
export const colors = {
  rastaGreen: "#006B3F",
  rastaGold: "#FFD700",
  rastaRed: "#CE1126",
  darkBg: "#1A1A0E",
  sand: "#F4E1C1",
  ocean: "#0077BE",
  wood: "#8B4513",
  bamboo: "#D4A857",
};
```

**Step 2: Build layout with Rasta theme**

Root layout with dark background, custom fonts (look for a hand-painted/reggae style Google Font), global CSS with the color palette.

**Step 3: Build MainMenu component**

Styled like a hand-painted Jamaican sign. Buttons:
- "Play vs AI" → difficulty select
- "Play Online" → lobby (placeholder for now)
- "Local Game" → (disabled, post-MVP)
- Settings icon (volume controls)

**Step 4: Build DifficultySelect component**

Three cards: Beach Bum / Selector / King Tubby with descriptions and themed illustrations (placeholder colored divs for now).

**Step 5: Create play page**

`apps/web/src/app/play/page.tsx` — accepts query params (`mode=ai&difficulty=easy`), will host the PixiJS canvas (placeholder div for now).

**Step 6: Verify dev server runs**

Run: `cd apps/web && npm run dev`
Verify: Main menu renders, navigation to /play works.

**Step 7: Commit**

```bash
git add apps/web/ && git commit -m "feat(web): add main menu, difficulty select, and Rasta theme"
```

---

## Task 9: PixiJS Board Renderer

**Files:**
- Create: `apps/web/src/game/BoardRenderer.ts`
- Create: `apps/web/src/game/PieceRenderer.ts`
- Create: `apps/web/src/game/DiceRenderer.ts`
- Create: `apps/web/src/components/GameCanvas.tsx`

**Step 1: Create GameCanvas React wrapper**

React component that creates a PixiJS `Application`, mounts it to a `<div>`, and cleans up on unmount. Passes the app instance down to renderers.

```tsx
"use client";
import { useEffect, useRef } from "react";
import { Application } from "pixi.js";

export function GameCanvas({ onReady }: { onReady: (app: Application) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const app = new Application();
    const init = async () => {
      await app.init({
        background: 0x1a1a0e,
        resizeTo: containerRef.current!,
        antialias: true,
      });
      containerRef.current!.appendChild(app.canvas);
      onReady(app);
    };
    init();
    return () => { app.destroy(true); };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

**Step 2: Implement BoardRenderer**

Draws the backgammon board using PixiJS Graphics:
- Outer frame (wood/bamboo colored rectangle with border)
- 24 triangular points alternating green and gold
- Bar in the middle ("Babylon" zone with darker styling)
- Home trays on the right ("Zion" with golden glow)
- Labels: "BABYLON" on the bar, "ZION" on home tray

Board should be responsive — calculate dimensions from container size.

**Step 3: Implement PieceRenderer**

Renders checker pieces on the board:
- Takes `GameState` and draws pieces stacked on each point
- Gold pieces: gold-colored circles with lion silhouette (or simple circle for MVP)
- Red pieces: red-colored circles
- Pieces on bar rendered in the Babylon zone
- Borne off pieces rendered in the Zion tray
- Max 5 pieces drawn per point; if more, show count number

**Step 4: Implement DiceRenderer**

Renders dice in the center of the board:
- Two square dice styled as speaker boxes
- Shows pip values
- Grays out used dice

**Step 5: Integrate into play page**

Wire up `GameCanvas` → `BoardRenderer` → `PieceRenderer` → render the initial game state.

**Step 6: Verify visually**

Run: `cd apps/web && npm run dev`, navigate to `/play`
Verify: Board renders with pieces in starting positions.

**Step 7: Commit**

```bash
git add apps/web/src/ && git commit -m "feat(web): add PixiJS board, piece, and dice renderers"
```

---

## Task 10: Game Interaction - Drag & Drop, Move Highlighting

**Files:**
- Create: `apps/web/src/game/InputHandler.ts`
- Modify: `apps/web/src/game/PieceRenderer.ts` (make pieces interactive)
- Modify: `apps/web/src/game/BoardRenderer.ts` (highlight legal target points)

**Step 1: Implement InputHandler**

Handles user interaction with the PixiJS canvas:
- Click a piece to select it (highlight it)
- Legal target points glow green
- Click a legal target to move, or drag the piece to it
- PixiJS `eventMode = 'static'` on pieces, `pointertap` and `pointerdown/move/up` for drag

**Step 2: Add move highlighting to BoardRenderer**

When a piece is selected, overlay a green glow on each legal target point. Use `getLegalMoves` from the engine filtered by the selected piece's position.

**Step 3: Add drag-and-drop to PieceRenderer**

Pieces become draggable. On drop:
- If dropped on a legal point → execute the move
- If dropped elsewhere → snap back to original position

**Step 4: Wire up callbacks**

InputHandler emits `onMoveSelected(move: Move)` which the GameController will consume.

**Step 5: Verify interaction**

Run dev, click pieces, see highlights, drag and drop.

**Step 6: Commit**

```bash
git add apps/web/src/ && git commit -m "feat(web): add drag-and-drop piece interaction and move highlighting"
```

---

## Task 11: Game Controller - Single Player vs AI

**Files:**
- Create: `apps/web/src/game/GameController.ts`
- Modify: `apps/web/src/app/play/page.tsx`

**Step 1: Implement GameController**

Orchestrates a full game loop:

```ts
class GameController {
  private state: GameState;
  private boardRenderer: BoardRenderer;
  private pieceRenderer: PieceRenderer;
  private diceRenderer: DiceRenderer;
  private inputHandler: InputHandler;
  private ai: AIPlayer | null;

  // Game loop:
  // 1. Current player rolls dice (click to roll, or auto-roll for AI)
  // 2. Renderer shows dice result
  // 3. If human: enable interaction, wait for moves
  //    If AI: compute moves after delay, animate them
  // 4. After all dice used (or no legal moves): check winner, switch turns
  // 5. Repeat until GAME_OVER
}
```

Key methods:
- `startGame(difficulty?)` — initializes state and begins the loop
- `handleRoll()` — rolls dice, transitions to MOVING phase
- `handleHumanMove(move)` — applies move, updates renderer, consumes die
- `handleAITurn()` — AI selects moves, animates them one by one with delays
- `handleTurnEnd()` — checks winner, switches player
- `render()` — updates all renderers with current state

**Step 2: Wire into play page**

`/play?mode=ai&difficulty=medium` creates a GameController with Selector AI.

**Step 3: Add piece movement animations**

When a move is applied, animate the piece sliding from source to target over ~300ms (PixiJS ticker-based tween or simple lerp).

**Step 4: Add dice roll button**

Overlay a "Roll" button (or click-the-dice) that triggers `handleRoll()`.

**Step 5: Play-test a full game**

Verify: Can play a complete game against Beach Bum, pieces move, dice work, hitting sends to bar, bearing off works, winner is detected.

**Step 6: Commit**

```bash
git add apps/web/src/ && git commit -m "feat(web): add GameController for single-player vs AI"
```

---

## Task 12: Audio - SoundManager & Reactive Soundtrack

**Files:**
- Create: `apps/web/src/audio/SoundManager.ts`
- Create: `apps/web/public/audio/` (placeholder audio files)
- Modify: `apps/web/src/game/GameController.ts` (integrate audio)

**Step 1: Source placeholder audio**

For development, create or source:
- 3 music stems (base rhythm, melodic, bass) — royalty-free reggae loops, same BPM/key
- ~10 sound effects — can use simple synthesized sounds initially
- Place in `apps/web/public/audio/`

**Step 2: Implement SoundManager**

```ts
class SoundManager {
  private stems: Record<string, Howl>;
  private sfx: Record<string, Howl>;
  private currentLayers: Set<string>;

  constructor() {
    this.stems = {
      base: new Howl({ src: ["/audio/stem-base.mp3"], loop: true }),
      melodic: new Howl({ src: ["/audio/stem-melodic.mp3"], loop: true }),
      bass: new Howl({ src: ["/audio/stem-bass.mp3"], loop: true }),
    };
    this.sfx = {
      diceRoll: new Howl({ src: ["/audio/sfx-dice.mp3"] }),
      pieceMove: new Howl({ src: ["/audio/sfx-move.mp3"] }),
      pieceHit: new Howl({ src: ["/audio/sfx-hit.mp3"] }),
      bearOff: new Howl({ src: ["/audio/sfx-bearoff.mp3"] }),
      victory: new Howl({ src: ["/audio/sfx-victory.mp3"] }),
    };
  }

  startMusic() { ... }         // Plays base stem
  updateGameState(state) { ... } // Fades layers in/out based on state
  playSFX(name: string) { ... }
  setVolume(v: number) { ... }
  mute() / unmute() { ... }
}
```

**Step 3: Wire state-driven transitions**

`updateGameState` analyzes the state and adjusts stems:
- Pieces on bar → fade in bass layer
- Bear-off phase → increase bass volume
- Even/chill → base + melodic only

**Step 4: Integrate into GameController**

Call `soundManager.playSFX("diceRoll")` on roll, `playSFX("pieceMove")` on move, etc.
Call `soundManager.updateGameState(state)` after each state change.

**Step 5: Add volume controls to UI**

A simple mute/unmute button and volume slider in the game HUD.

**Step 6: Verify audio plays during gameplay**

**Step 7: Commit**

```bash
git add apps/web/ && git commit -m "feat(web): add SoundManager with reactive reggae stems and SFX"
```

---

## Task 13: Game HUD - Doubling Cube, Score, Timer

**Files:**
- Create: `apps/web/src/components/GameHUD.tsx`
- Modify: `apps/web/src/app/play/page.tsx`

**Step 1: Build GameHUD component**

React overlay on top of the PixiJS canvas:
- **Score display:** Player names, match score, current game stake
- **Doubling cube ("Turn It Up"):** Visual knob showing current value. Click to offer double.
- **Win type labels:** "Ya Mon (1x)" / "Big Ya Mon (2x)" / "MASSIVE Ya Mon (3x)" shown at game end
- **Volume control:** Mute button + slider

**Step 2: Wire doubling cube interaction**

"Turn It Up" button appears before rolling (when `canOfferDouble` returns true). Clicking it sends the double offer. Opponent (AI or human) responds.

For AI: AI's `shouldAcceptDouble()` method decides. Show brief "thinking" delay.

**Step 3: Add game-over overlay**

When game ends:
- Display win type with themed animation text
- "Play Again" / "Back to Menu" buttons
- If "MASSIVE Ya Mon" → special dramatic styling

**Step 4: Commit**

```bash
git add apps/web/src/ && git commit -m "feat(web): add game HUD with Turn It Up doubling cube and score display"
```

---

## Task 14: Multiplayer Server - Socket.io Rooms & State Sync

**Files:**
- Modify: `apps/server/src/index.ts`
- Create: `apps/server/src/rooms.ts`
- Create: `apps/server/src/auth.ts`
- Create: `apps/server/src/db/schema.ts`
- Create: `apps/server/src/db/index.ts`

**Step 1: Set up Drizzle + SQLite**

`apps/server/src/db/schema.ts`:
```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const guests = sqliteTable("guests", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  goldPlayerId: text("gold_player_id").notNull(),
  redPlayerId: text("red_player_id").notNull(),
  winnerId: text("winner_id"),
  winType: text("win_type"),
  doublingCubeValue: integer("doubling_cube_value"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

**Step 2: Implement guest auth**

Simple: generate a UUID + random Rasta-themed display name (e.g., "CoolSelector42", "ZionLion7"). Store in SQLite. Return ID + name to client. Token stored in a cookie.

**Step 3: Implement game rooms**

```ts
// apps/server/src/rooms.ts
interface GameRoom {
  id: string;
  gold: { socketId: string; playerId: string } | null;
  red: { socketId: string; playerId: string } | null;
  state: GameState;
  createdAt: Date;
}

// Socket events:
// Client -> Server:
//   "create-room" -> returns room code (for invite links)
//   "join-room" { roomId } -> joins existing room
//   "quick-match" -> enters matchmaking queue
//   "roll-dice" -> server rolls, broadcasts to both
//   "make-move" { move } -> server validates, applies, broadcasts
//   "offer-double" -> server relays to opponent
//   "respond-double" { accept: boolean }
//
// Server -> Client:
//   "room-joined" { roomId, player, state }
//   "opponent-joined" { opponentName }
//   "dice-rolled" { dice }
//   "move-made" { move, state }
//   "turn-changed" { currentPlayer }
//   "double-offered"
//   "double-response" { accepted, newCubeValue }
//   "game-over" { winner, winType, points }
//   "opponent-disconnected"
//   "opponent-reconnected"
```

**Step 4: Server validates all moves**

When receiving "make-move", server:
1. Checks it's the sender's turn
2. Runs `getLegalMoves(state)` and verifies the move is in the list
3. Applies via `applyMove(state, move)`
4. Broadcasts the new state to both players

**Step 5: Handle disconnects**

On disconnect: start 30s timer. If opponent reconnects (same playerId), resume. Otherwise, other player wins by forfeit.

**Step 6: Test with a manual Socket.io client**

Run: `cd apps/server && npm run dev`
Verify: Can connect, create room, second client joins, dice roll broadcasts.

**Step 7: Commit**

```bash
git add apps/server/ && git commit -m "feat(server): add Socket.io game rooms, move validation, and guest auth"
```

---

## Task 15: Multiplayer Client - Online Play Integration

**Files:**
- Create: `apps/web/src/multiplayer/SocketClient.ts`
- Create: `apps/web/src/app/lobby/page.tsx`
- Create: `apps/web/src/components/LobbyUI.tsx`
- Modify: `apps/web/src/game/GameController.ts` (add multiplayer mode)

**Step 1: Implement SocketClient**

```ts
class SocketClient {
  private socket: Socket;

  connect(serverUrl: string) { ... }
  createRoom(): Promise<string> { ... }    // Returns room code
  joinRoom(roomId: string): Promise<void> { ... }
  quickMatch(): Promise<void> { ... }
  rollDice(): void { ... }
  makeMove(move: Move): void { ... }
  offerDouble(): void { ... }
  respondToDouble(accept: boolean): void { ... }

  // Event handlers
  onOpponentJoined(cb: (name: string) => void) { ... }
  onDiceRolled(cb: (dice: Dice) => void) { ... }
  onMoveMade(cb: (move: Move, state: GameState) => void) { ... }
  onGameOver(cb: (winner: Player, winType: WinType) => void) { ... }
  // etc.
}
```

**Step 2: Build lobby page**

`/lobby` page with:
- "Quick Match" button — enters queue, shows "Searching for opponent..." with a reggae-themed loading animation
- "Create Private Room" — generates room code, shows shareable invite link
- "Join Room" — text input for room code

**Step 3: Extend GameController for multiplayer**

GameController gets a `mode: "ai" | "online" | "local"` flag.

In online mode:
- Dice rolls come from server (not local)
- Player can only interact on their turn
- Moves are sent to server; state updates come from server events
- Opponent moves are animated when received

**Step 4: Handle connection errors**

Show toast/banner for: "Opponent disconnected — waiting for reconnect..." and "Connection lost — attempting to reconnect..."

**Step 5: End-to-end test**

Open two browser tabs. One creates a room, other joins via code. Play a few turns. Verify moves sync.

**Step 6: Commit**

```bash
git add apps/web/src/ && git commit -m "feat(web): add online multiplayer lobby and Socket.io client integration"
```

---

## Task 16: Visual Polish & Animations

**Files:**
- Modify: `apps/web/src/game/BoardRenderer.ts`
- Modify: `apps/web/src/game/PieceRenderer.ts`
- Modify: `apps/web/src/game/DiceRenderer.ts`
- Modify: `apps/web/src/components/MainMenu.tsx`

**Step 1: Enhance board visuals**

- Add wood grain texture to the board frame (can generate procedurally with PixiJS noise or use a texture image)
- Add subtle wave animation to background (sine-wave displacement on a blue gradient)
- Babylon bar: darker, urban texture
- Zion home tray: golden gradient with subtle glow

**Step 2: Enhance piece animations**

- Idle bob: pieces gently float up/down (sine wave on y position, ~2px amplitude)
- Move animation: ease-out slide with motion trail (fading copies)
- Hit animation: displaced piece "falls" to bar with a bounce
- Bear off: piece slides off screen with a wave particle effect

**Step 3: Enhance dice animations**

- Roll animation: dice tumble (rotate + bounce) for ~1 second before landing
- Doubles: flash effect + "BOOMSHOT!" text that scales up and fades

**Step 4: Polish main menu**

- Animated title text with a subtle reggae bounce
- Background: slow-scrolling beach/island scene or gradient
- Button hover effects: glow in Rasta colors

**Step 5: Win/loss celebration**

- Ya Mon: gold particle explosion + "YA MON!" text
- Big Ya Mon: larger explosion + lion roar audio cue
- MASSIVE Ya Mon: full screen takeover, dramatic dark-to-gold transition, particles, text

**Step 6: Commit**

```bash
git add apps/web/src/ && git commit -m "feat(web): add visual polish, animations, and win celebrations"
```

---

## Task 17: Responsive Layout & Final Integration

**Files:**
- Modify: `apps/web/src/components/GameCanvas.tsx`
- Modify: `apps/web/src/game/BoardRenderer.ts`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: various CSS/Tailwind

**Step 1: Make the board responsive**

BoardRenderer calculates all dimensions relative to container size. On window resize, recalculate and re-render. Board maintains aspect ratio (~1.4:1 landscape), centered in the viewport.

**Step 2: Handle tablet layout**

Ensure touch events work for drag-and-drop (PixiJS handles this natively with pointer events). Game HUD stacks vertically on narrower screens. Font sizes scale down appropriately.

**Step 3: Desktop layout**

On wide screens: board centered with player info panels on left/right. Score, doubling cube, and controls are comfortably placed.

**Step 4: Add meta tags and favicon**

- Open Graph tags for social sharing ("Play Backyamon - Ya Mon!")
- Rasta-themed favicon (small lion head or flag colors)

**Step 5: Full integration test**

Test the complete flow:
1. Land on main menu
2. Select "Play vs AI" → pick difficulty → game starts
3. Roll dice, make moves, hear music and SFX
4. Play to completion, see win screen
5. Return to menu, "Play Online" → create room → join from another tab → play a multiplayer game

**Step 6: Commit**

```bash
git add apps/web/ && git commit -m "feat(web): responsive layout and final integration"
```

---

## Task 18: Deployment Setup

**Files:**
- Create: `apps/web/Dockerfile` (or Vercel config)
- Create: `apps/server/Dockerfile`
- Create: `docker-compose.yml` (optional, for self-hosting)

**Step 1: Web app deployment**

Next.js deploys easily to **Vercel**:
- Connect the GitHub repo
- Set root directory to `apps/web`
- Build command: `cd ../.. && npx turbo build --filter=@backyamon/web`
- Environment variable: `NEXT_PUBLIC_SERVER_URL` (points to the multiplayer server)

**Step 2: Server deployment**

Socket.io server can deploy to **Railway**, **Fly.io**, or **Render**:
- Dockerfile that builds the server package
- Exposes port 3001
- SQLite file persisted on a volume

**Step 3: Configure CORS**

Server must allow connections from the Vercel domain. Set `cors: { origin: process.env.WEB_URL }` in Socket.io config.

**Step 4: Verify deployed**

Test: Visit deployed URL, play a game vs AI, play a multiplayer game.

**Step 5: Commit**

```bash
git add . && git commit -m "chore: add deployment configuration"
```

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Project scaffolding & monorepo | Low |
| 2 | Engine: core types & initial state | Low |
| 3 | Engine: dice & move generation | High |
| 4 | Engine: bearing off | Medium |
| 5 | Engine: win detection & scoring | Low |
| 6 | Engine: turn management & doubling cube | Medium |
| 7 | Engine: AI players (3 tiers) | High |
| 8 | Next.js app shell & main menu | Medium |
| 9 | PixiJS board renderer | High |
| 10 | Game interaction: drag & drop | Medium |
| 11 | Game controller: single player vs AI | High |
| 12 | Audio: SoundManager & reactive soundtrack | Medium |
| 13 | Game HUD: doubling cube, score, timer | Low |
| 14 | Multiplayer server: rooms & state sync | High |
| 15 | Multiplayer client: online play | High |
| 16 | Visual polish & animations | Medium |
| 17 | Responsive layout & final integration | Medium |
| 18 | Deployment setup | Low |

**Critical path:** Tasks 1-7 (engine) can be built and tested with zero UI. Tasks 8-13 (frontend + audio) depend on the engine. Tasks 14-15 (multiplayer) depend on both engine and frontend. Tasks 16-18 are polish and deployment.

**Parallelizable:** Engine work (Tasks 2-7) can happen in parallel with app shell (Task 8) since they're independent packages.
