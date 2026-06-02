# 🦁 Backyamon

**Ya Mon!** 🇯🇲 A Caribbean-themed backgammon web game.

Play backgammon with island vibes 🌴 - reggae-inspired visuals, themed game elements, and a communal audio experience. Send pieces to **Babylon** ⛓️ (the bar), bear them off to **Zion** ✨ (home), and battle AI opponents or play friends online.

## 🎲 Features

- 🎯 **Full backgammon rules** - hitting, bearing off, doubling cube ("Turn It Up"), Crawford rule
- 🤖 **3 AI opponents** - Beach Bum (easy), Selector (medium), King Tubby (hard)
- 🌍 **Online multiplayer** - quick match, private rooms with invite codes, guest accounts
- 🟢🟡🔴 **Caribbean theme** - green/gold/red color palette, wood-grain board, themed animations
- 🏆 **Themed scoring** - Ya Mon (1x), Big Ya Mon (2x), MASSIVE Ya Mon (3x)
- 🔊 **Sound effects** - synthetic audio with support for real audio assets
- 📱 **Installable PWA** - offline support via a service worker; also a native **iOS app**
- 🎨 **Custom assets** - design your own pieces, music, and sounds (stored in Cloudflare R2)

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| 🧠 Game engine | Pure TypeScript (shared client/server) |
| 🎨 Frontend | Next.js 15, PixiJS 8, Howler.js, Tailwind CSS 4 |
| 🖥️ Server | Node.js, Socket.io, Drizzle ORM, SQLite (libSQL) |
| 📦 Monorepo | Turborepo + npm workspaces |
| 📲 PWA | Serwist service worker (offline + installable) |
| ☁️ Infra | Docker Compose + host nginx + certbot, on a single VPS |
| 💾 Storage | Cloudflare R2 (assets + DB backups via Litestream) |
| 📱 iOS | SwiftUI app in a separate repo (`backyamon-swift`) |
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
├── packages/engine/     # 🧠 Pure TS backgammon rules + AI (@backyamon/engine)
├── apps/web/            # 🎨 Next.js frontend + PixiJS renderer (PWA)
├── apps/server/         # 🖥️ Socket.io multiplayer server
├── docs/                # 📚 Architecture, game rules, theming
├── Dockerfile.web       # 🐳 Frontend image (next start)
├── Dockerfile.server    # 🐳 Backend image
├── docker-compose.yml   # 🐳 web + server + litestream
├── litestream.yml       # 💾 SQLite → R2 backup config
├── deploy/nginx/        # 🌐 nginx server block for backyamon.com
└── DEPLOY.md            # 📋 Deployment + restore runbook
```

> The **iOS app** lives in a separate repository (`backyamon-swift`), not in this monorepo.

## 🚀 Deployment & Infrastructure

Everything runs on **one VPS** (`devbox`). Host **nginx** terminates TLS and reverse-proxies
to three Docker containers. Web and realtime share one origin (`backyamon.com`), so there's
no CORS. App state lives outside the containers (a SQLite file + Cloudflare R2), making the
containers disposable.

```
                          ┌──────────────────── VPS (devbox) ────────────────────┐
  backyamon.com ────────▶ │ nginx :443 ─┬─ /socket.io/ ─▶ backyamon-server :3001  │
  www.backyamon.com ────▶ │  (host)     └─ /*           ─▶ backyamon-web    :3000 │
  api.backyamon.com ────▶ │ nginx :443 ──────────────────▶ backyamon-server :3001 │ ◀── iOS app
                          │                                                        │
                          │ backyamon-litestream ──(continuous)──┐                 │
                          └──────────────────────────────────────┼─────────────────┘
                                                                  ▼
   DB:     SQLite ./data/backyamon.db ───── Litestream ─────▶ Cloudflare R2: backyamon-backups
   Assets: Cloudflare R2: backyamon-assets  (custom pieces / music / sounds)
   DNS:    Cloudflare (DNS-only / grey cloud)      TLS: Let's Encrypt via certbot
```

### Where everything lives

| Piece | What | Where it runs |
|-------|------|---------------|
| **Frontend** | Next.js 15 PWA (`apps/web`) | `backyamon-web` container `:3000` → `backyamon.com` |
| **Backend** | Socket.io server (`apps/server`) | `backyamon-server` container `:3001` → `backyamon.com/socket.io` + `api.backyamon.com` |
| **Engine** | Shared logic (`packages/engine`) | Bundled into both apps at build time |
| **Database** | SQLite (drizzle + libSQL) | `./data/backyamon.db` on the VPS (host volume) |
| **DB backups** | Litestream → R2 | `backyamon-litestream` container → `backyamon-backups` bucket |
| **Asset files** | Custom pieces / music / sounds | Cloudflare R2 `backyamon-assets` |
| **iOS app** | SwiftUI client | Separate repo; talks to `api.backyamon.com` |
| **DNS** | `backyamon.com`, `www`, `api` | Cloudflare (grey cloud / DNS-only) |
| **TLS** | All hostnames | certbot / Let's Encrypt on host nginx |

> **Legacy (decommissioning):** the frontend was previously on **Vercel** and the server on
> **Render**. DNS now points at the VPS — remove the Vercel domain and delete the Render
> service once you're confident in the VPS setup.

### Deploying

Full runbook in **[DEPLOY.md](./DEPLOY.md)**. Short version, on the VPS:

```bash
git pull
docker compose up -d --build    # rebuild changed images, recreate containers
docker compose ps               # web + server + litestream should be Up
```

> ⚠️ `NEXT_PUBLIC_SERVER_URL` is baked into the web bundle at **build time** (build arg in
> `docker-compose.yml`). Changing it requires a rebuild, not just a restart.

### Configuration (`.env` on the VPS)

Copy `.env.example` → `.env` and fill in: `WEB_URL` (CORS allowlist),
`TURSO_DATABASE_URL` (`file:/data/backyamon.db` for local SQLite),
and the R2 keys (`R2_ACCOUNT_ID` — **bare ID, no `https://`** — `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`).

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

- 🔌 [Socket.IO Protocol](PROTOCOL.md) — realtime contract shared by web + iOS
- 📋 [Deployment runbook](DEPLOY.md)
- 🏗️ [Architecture](docs/ARCHITECTURE.md)
- 🎲 [Game Rules](docs/GAME-RULES.md)
- 🎨 [Theming](docs/THEMING.md)
- 🤝 [Contributing](docs/CONTRIBUTING.md)
- 📐 [Design Doc](docs/plans/2026-02-23-backyamon-design.md)

## 📄 License

MIT
