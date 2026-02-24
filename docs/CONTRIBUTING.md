# Contributing to Backyamon

## Prerequisites

- Node.js 18+
- npm (comes with Node.js)

## Setup

```bash
git clone <repo-url>
cd backyamon
npm install
npx turbo dev
```

This starts:
- Next.js frontend on `http://localhost:3000`
- Multiplayer server on `http://localhost:3001`
- Engine in watch mode (recompiles on change)

## Project Structure

```
backyamon/
├── packages/
│   └── engine/          # @backyamon/engine - pure TypeScript game logic
│                        #   Rules, state management, AI, scoring
│                        #   NO browser or Node.js APIs
├── apps/
│   ├── web/             # @backyamon/web - Next.js 15 frontend
│   │                    #   PixiJS renderer, Howler.js audio, Tailwind CSS
│   └── server/          # @backyamon/server - Node.js multiplayer server
│                        #   Socket.io rooms, Drizzle ORM + SQLite
├── docs/                # Documentation and design plans
├── package.json         # Workspace root
└── turbo.json           # Turborepo task configuration
```

## Where to Make Changes

| Change | Package | Notes |
|---|---|---|
| Game rules, move logic, AI | `packages/engine/` | Pure functions. Must have tests. No UI code. |
| Board rendering, animations | `apps/web/src/game/` | PixiJS renderers |
| Audio, sound effects | `apps/web/src/audio/` | Howler.js `SoundManager` |
| Pages, menus, HUD | `apps/web/src/app/`, `src/components/` | React + Tailwind |
| Multiplayer networking (client) | `apps/web/src/multiplayer/` | Socket.io client |
| Multiplayer networking (server) | `apps/server/src/` | Socket.io server, rooms, matchmaking |
| Database schema | `apps/server/src/db/` | Drizzle ORM schema and migrations |

## Running Tests

All packages:

```bash
npx turbo test
```

Engine only (fastest feedback loop):

```bash
cd packages/engine && npx vitest        # Watch mode
cd packages/engine && npx vitest run    # Single run
```

## Development Workflow

1. **Engine changes first.** If a feature involves new game logic, implement and test it in `packages/engine/` before touching the UI. The engine has zero dependencies on the frontend -- it can be developed and tested in isolation.

2. **TDD for the engine.** Write the failing test, implement the logic, verify the test passes. Every function in the engine should have corresponding test coverage.

3. **One commit per feature.** Keep commits focused: a new engine module, a new renderer, a new UI component. This makes review and rollback straightforward.

4. **Pure functions in the engine.** All state transitions must be immutable (`applyMove` returns a new state). No side effects. No global mutable state. This makes the engine testable and shareable between client and server.

## Build

```bash
npx turbo build
```

Turborepo handles the dependency graph: engine builds first, then web and server build in parallel (both depend on engine).

## Conventions

- **TypeScript strict mode** across all packages
- **Immutable state** in the engine -- never mutate `GameState` in place
- **Barrel exports** via `index.ts` in each package
- **Vitest** for engine tests
- **Tailwind CSS** for UI styling (menus, HUD, lobby -- not the PixiJS canvas)
- **PixiJS Graphics** for board rendering (not DOM elements)
