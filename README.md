# 🦁 Backyamon

**Ya Mon!** 🇯🇲 A Rastafarian-themed backgammon web game.

Play backgammon with island vibes 🌴 - reggae-inspired visuals, themed game elements, and a communal audio experience. Send pieces to **Babylon** ⛓️ (the bar), bear them off to **Zion** ✨ (home), and battle AI opponents or play friends online.

## 🎲 Features

- 🎯 **Full backgammon rules** - hitting, bearing off, doubling cube ("Turn It Up"), Crawford rule
- 🤖 **3 AI opponents** - Beach Bum (easy), Selector (medium), King Tubby (hard)
- 🌍 **Online multiplayer** - quick match, private rooms with invite codes, guest accounts
- 🟢🟡🔴 **Rasta theme** - green/gold/red color palette, wood-grain board, themed animations
- 🏆 **Themed scoring** - Ya Mon (1x), Big Ya Mon (2x), MASSIVE Ya Mon (3x)
- 🔊 **Sound effects** - synthetic audio with support for real audio assets
- 📱 **Responsive** - desktop and tablet

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| 🧠 Game engine | Pure TypeScript (shared client/server) |
| 🎨 Frontend | Next.js 15, PixiJS 8, Howler.js, Tailwind CSS 4 |
| 🖥️ Server | Node.js, Socket.io, Drizzle ORM, SQLite |
| 📦 Monorepo | Turborepo + npm workspaces |
| ✅ Testing | Vitest (107 tests) |

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run everything in dev mode
npx turbo dev

# Web app: http://localhost:3000
# Server:  http://localhost:3001
```

## 📁 Project Structure

```
backyamon/
├── packages/engine/     # 🧠 Pure TS backgammon rules + AI
├── apps/web/            # 🎨 Next.js frontend + PixiJS renderer
├── apps/server/         # 🖥️ Socket.io multiplayer server
└── docs/                # 📚 Architecture, game rules, theming
```

## 📜 Scripts

```bash
npx turbo build          # Build all packages
npx turbo test           # Run all tests
npx turbo dev            # Dev mode (web + server)
```

## 🗺️ Roadmap

- 🎵 **v1.0** "First Riddim" - Core game, AI, online multiplayer *(current)*
- 🔈 **v1.1** "Sound System" - Global jukebox, loop mixer, trigger pads
- 🎛️ **v1.2** "Selector's Choice" - Ranked play, leaderboards, cosmetics
- 🏘️ **v1.3** "Big Yard" - Progression system, friend lists, streaming integration
- 🏔️ **v1.4** "Road to Zion" - Story mode, tournaments, live audio streaming

## 📖 Docs

- 🏗️ [Architecture](docs/ARCHITECTURE.md)
- 🎲 [Game Rules](docs/GAME-RULES.md)
- 🎨 [Theming](docs/THEMING.md)
- 🤝 [Contributing](docs/CONTRIBUTING.md)
- 📐 [Design Doc](docs/plans/2026-02-23-backyamon-design.md)

## 📄 License

MIT
