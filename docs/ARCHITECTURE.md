# Backyamon Architecture

## Overview

Backyamon is a three-layer web application built as a TypeScript monorepo. The game engine is a pure logic module shared between the client (for offline/AI play) and server (for multiplayer move validation).

```
┌──────────────────────────────────────────────────┐
│              Next.js 15 App Shell                │
│   (lobby, auth, profiles, menus, HUD, chat)      │
├──────────────────────────────────────────────────┤
│            PixiJS 8 Game Canvas                  │
│   (board, pieces, dice, drag-and-drop,           │
│    animations, visual effects)                   │
├──────────────────────────────────────────────────┤
│     Howler.js Audio    │    InputHandler          │
│   (reactive stems,     │  (click, drag-and-drop)  │
│    sound effects)      │                          │
├──────────────────────────────────────────────────┤
│           @backyamon/engine (pure TS)            │
│   (rules, state, moves, AI, scoring)             │
└────────────────┬─────────────────────────────────┘
                 │ Socket.io (multiplayer only)
┌────────────────┴─────────────────────────────────┐
│           Node.js Multiplayer Server             │
│   (matchmaking, rooms, state sync, validation,   │
│    persistence via Drizzle ORM + SQLite)          │
└──────────────────────────────────────────────────┘
```

## Package Structure

### `packages/engine/` (`@backyamon/engine`)

Pure TypeScript game logic with zero UI dependencies. This is the core of the project.

| Module | Responsibility |
|---|---|
| `types.ts` | `GameState`, `Move`, `Turn`, `Player`, `GamePhase`, `WinType`, `DoublingCube`, `Dice` |
| `constants.ts` | Board layout, initial positions, home board ranges, move directions |
| `state.ts` | `createInitialState()`, `cloneState()` (immutable state management) |
| `dice.ts` | `rollDice()`, `getDiceMoveCounts()` |
| `moves.ts` | `getLegalMoves()`, `applyMove()` (core rules enforcement) |
| `bearing-off.ts` | `canBearOff()`, `getBearOffMoves()` |
| `winner.ts` | `checkWinner()`, `getWinType()`, `getPointsWon()` |
| `turn.ts` | `endTurn()`, `getAllLegalTurns()`, forced move validation |
| `doubling.ts` | `canOfferDouble()`, `offerDouble()`, `acceptDouble()`, `declineDouble()` |
| `ai/beach-bum.ts` | Easy AI -- random legal moves |
| `ai/selector.ts` | Medium AI -- weighted heuristic evaluation |
| `ai/king-tubby.ts` | Hard AI -- minimax with alpha-beta pruning, depth 3 |

Key design decisions:
- All state transitions are **immutable** (`applyMove` returns a new `GameState`, never mutates)
- All functions are **pure** (deterministic given inputs, except `rollDice` with its optional `forced` parameter for testing)
- No browser or Node.js APIs -- runs anywhere TypeScript runs

### `apps/web/` (`@backyamon/web`)

Next.js 15 frontend. Handles rendering, interaction, audio, and multiplayer client.

| Directory | Responsibility |
|---|---|
| `src/app/` | Next.js App Router pages: main menu, `/play`, `/lobby` |
| `src/game/` | PixiJS renderers and game orchestration |
| `src/game/GameController.ts` | Orchestrates engine + renderers + audio + input for the game loop |
| `src/game/BoardRenderer.ts` | Draws the board (points, bar, home trays) using PixiJS Graphics |
| `src/game/PieceRenderer.ts` | Renders and animates checker pieces |
| `src/game/DiceRenderer.ts` | Renders dice with roll animations |
| `src/game/InputHandler.ts` | Click-to-move and drag-and-drop via PixiJS pointer events |
| `src/audio/SoundManager.ts` | Howler.js wrapper for reactive stem layering and SFX |
| `src/multiplayer/SocketClient.ts` | Socket.io client wrapper for online play |
| `src/components/` | React components: `GameCanvas`, `MainMenu`, `GameHUD`, `LobbyUI`, `DifficultySelect` |
| `src/lib/theme.ts` | Rasta color palette, fonts |
| `public/audio/` | Music stems and sound effects |
| `public/sprites/` | Board, piece, and dice sprite sheets |

### `apps/server/` (`@backyamon/server`)

Node.js multiplayer server.

| Module | Responsibility |
|---|---|
| `src/index.ts` | Server entry point, Socket.io setup (port 3001) |
| `src/rooms.ts` | Game room lifecycle: create, join, state sync, disconnect handling |
| `src/matchmaking.ts` | Quick match queue (ELO-based), private room invite links |
| `src/auth.ts` | Guest account generation (UUID + random themed display name) |
| `src/db/schema.ts` | Drizzle ORM schema: `guests`, `matches` tables |
| `src/db/index.ts` | SQLite database connection |

## Shared Engine Pattern

The engine is the single source of truth for game rules. Both client and server depend on it via `workspace:*`:

```
@backyamon/web ──depends──> @backyamon/engine <──depends── @backyamon/server
```

This enables:
- **Client-side AI**: Engine + AI run entirely in the browser. No server round-trips for single-player.
- **Server-side validation**: In multiplayer, the server runs `getLegalMoves()` to verify every player move before broadcasting. Prevents cheating.
- **Offline play**: Once assets are cached, the engine and AI run without any network connection.

## Data Flow

### Single-Player (vs AI)

Everything runs client-side. No server involved.

```
Player clicks piece
  → InputHandler detects click, identifies selected piece
  → InputHandler calls getLegalMoves(state) from engine
  → BoardRenderer highlights legal target points

Player clicks target / drops piece
  → InputHandler emits onMoveSelected(move)
  → GameController calls applyMove(state, move) from engine
  → GameController updates renderers (PieceRenderer, DiceRenderer)
  → SoundManager plays move SFX, adjusts music stems based on new state
  → GameController checks for turn end / winner

AI turn
  → GameController calls ai.selectMoves(state) after artificial delay (0.5-2s)
  → GameController animates each AI move sequentially
  → SoundManager plays corresponding SFX
  → GameController checks for turn end / winner
```

### Multiplayer (Online)

Server is authoritative. Client sends intentions, server validates and broadcasts.

```
Player clicks piece / target
  → InputHandler emits onMoveSelected(move)
  → SocketClient sends "make-move" { move } to server

Server receives "make-move"
  → Server runs getLegalMoves(state) to validate
  → If valid: applyMove(state, move), broadcast "move-made" to both players
  → If invalid: reject, client snaps piece back

Both clients receive "move-made"
  → GameController updates state from server payload
  → PieceRenderer animates the move
  → SoundManager plays SFX and adjusts stems
  → GameController checks for turn end

Dice rolls
  → Player sends "roll-dice" to server
  → Server calls rollDice(), broadcasts "dice-rolled" to both
  → Both clients render the dice result
```

### Socket.io Event Protocol

| Direction | Event | Payload |
|---|---|---|
| Client to Server | `create-room` | -- |
| Client to Server | `join-room` | `{ roomId }` |
| Client to Server | `quick-match` | -- |
| Client to Server | `roll-dice` | -- |
| Client to Server | `make-move` | `{ move: Move }` |
| Client to Server | `offer-double` | -- |
| Client to Server | `respond-double` | `{ accept: boolean }` |
| Server to Client | `room-joined` | `{ roomId, player, state }` |
| Server to Client | `opponent-joined` | `{ opponentName }` |
| Server to Client | `dice-rolled` | `{ dice: Dice }` |
| Server to Client | `move-made` | `{ move, state }` |
| Server to Client | `turn-changed` | `{ currentPlayer }` |
| Server to Client | `double-offered` | -- |
| Server to Client | `double-response` | `{ accepted, newCubeValue }` |
| Server to Client | `game-over` | `{ winner, winType, points }` |
| Server to Client | `opponent-disconnected` | -- |
| Server to Client | `opponent-reconnected` | -- |

## Technology Choices

| Technology | Why |
|---|---|
| **Next.js 15 (App Router)** | SSR/SSG for fast initial load, API routes for future features, file-based routing, easy Vercel deployment. The App Router provides React Server Components for the lobby and menu pages while the game canvas is a client component. |
| **PixiJS 8** | Purpose-built 2D WebGL/WebGPU renderer. Far better than DOM manipulation for game animations (60fps piece movement, particle effects, smooth dice rolls). Lightweight compared to full game frameworks. |
| **Howler.js** | Web Audio API wrapper that handles cross-browser quirks. Supports concurrent audio playback needed for stem layering (multiple music loops playing simultaneously with independent volume control). |
| **Socket.io** | Real-time bidirectional communication with built-in room management (one room per game), auto-reconnect (30s disconnect window), and fallback to long-polling. Simpler than raw WebSockets for the room/event patterns we need. |
| **Drizzle ORM + SQLite** | Lightweight, zero-config persistence. No external database server to run during development. SQLite file lives on disk. Drizzle provides type-safe queries and schema migrations. Can swap to Postgres later by changing the driver -- Drizzle abstracts the dialect. |
| **Vitest** | Fast, TypeScript-native test runner. Runs engine tests without compilation step. Compatible with the same assertion patterns as Jest but significantly faster due to native ESM support. |
| **Turborepo** | Monorepo build orchestration. Handles dependency graph (`web` and `server` depend on `engine`), parallel task execution, and build caching. `turbo dev` runs all three packages concurrently. |
| **Tailwind CSS 4** | Utility-first CSS for the Next.js UI shell (menus, lobby, HUD). The game board itself is rendered via PixiJS, not CSS. |
| **TypeScript (strict)** | Type safety across all three packages. The shared `GameState` type is the contract between engine, client, and server. |

## Offline Play

Backyamon supports full offline play for single-player and local modes:

1. **Service Worker**: Caches all static assets (HTML, JS, CSS, audio stems, sprite sheets) after the first page load. Configured via Next.js PWA support.
2. **Engine runs in-browser**: `@backyamon/engine` is pure TypeScript bundled into the client JS. No server calls needed for game logic.
3. **AI runs in-browser**: All three AI opponents (Beach Bum, Selector, King Tubby) execute client-side with artificial thinking delays.
4. **Audio cached locally**: Howler.js loads audio from the browser cache. Stems loop independently.

The only feature requiring a network connection is online multiplayer.

## Build and Deploy

- **Web app**: Deploys to Vercel. Build command: `npx turbo build --filter=@backyamon/web`. Environment variable `NEXT_PUBLIC_SERVER_URL` points to the multiplayer server.
- **Server**: Deploys to Railway, Fly.io, or Render via Dockerfile. Exposes port 3001. SQLite file persisted on a volume. CORS configured to allow the Vercel domain.
- **Engine**: Not deployed independently. Built as a dependency of both `web` and `server` via Turborepo's `dependsOn: ["^build"]`.

## Further Reading

- [Design Document](plans/2026-02-23-backyamon-design.md) -- full game design specification
- [Implementation Plan](plans/2026-02-23-backyamon-implementation.md) -- task-by-task build plan
