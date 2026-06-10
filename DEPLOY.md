# Deploying Backyamon to the VPS

Everything runs on one box under `backyamon.com`: the Next.js frontend and the
Socket.IO server as Docker containers, with host **Caddy** terminating TLS and
reverse-proxying to them. Same origin → no CORS, one deploy, one domain.

```
                         ┌─────────── VPS (host Caddy) ───────────┐
  backyamon.com  ──────▶ │  :443  ─┬─ /socket.io/ ─▶ server :3001  │
  www.backyamon.com ───▶ │         └─ /*           ─▶ web    :3000 │
  api.backyamon.com ───▶ │  :443  ──────────────── ─▶ server :3001 │ (iOS app: HTTPS)
                         └────────────────────────────────────────┘
                          DB → SQLite (./data volume)   Assets → Cloudflare R2
```

Caddy config is split: a host-wide stub at `/etc/caddy/Caddyfile` (installed
once, imports `/etc/caddy/sites/*.caddy`) and per-project site files, each
versioned in its own repo. This repo owns `deploy/caddy/backyamon.caddy`.
**App deploys must never overwrite `/etc/caddy/Caddyfile` itself.**

## 1. DNS (Cloudflare)

Add records pointing the apex + www at the VPS. Set them to **DNS only (grey
cloud)** so Caddy can issue Let's Encrypt certs and serve TLS directly:

| Type | Name | Value          | Proxy    |
|------|------|----------------|----------|
| A    | `@`  | `<VPS_IP>`     | DNS only |
| A    | `www`| `<VPS_IP>`     | DNS only |

`api.backyamon.com` already points at the VPS — leave it.

## 2. Get the code + env on the VPS

```bash
git clone https://github.com/suzikang17/backyamon.git   # or: git pull
cd backyamon
cp .env.example .env
nano .env            # fill in R2 creds. DB defaults to local SQLite (./data) —
                     # no Turso needed. See comments in the file.
```

## 3. Build & run the containers

```bash
docker compose up -d --build
docker compose ps               # web + server should be "running"
curl -I http://127.0.0.1:3000   # frontend responds
curl  http://127.0.0.1:3001/socket.io/?EIO=4\&transport=polling   # server handshake
```

## 4. Caddy + TLS

One-time host setup (skip if `/etc/caddy/Caddyfile` already imports
`/etc/caddy/sites/*.caddy`):

```bash
sudo mkdir -p /etc/caddy/sites
sudo cp deploy/caddy/Caddyfile.host /etc/caddy/Caddyfile
```

Deploy (or update) this project's site config:

```bash
sudo cp deploy/caddy/backyamon.caddy /etc/caddy/sites/
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy obtains + auto-renews Let's Encrypt certs for all three hostnames — no
certbot. `api.backyamon.com` must be a normal HTTPS site (the iOS app connects
to `https://api.backyamon.com`); an `http://`-prefixed block makes Caddy reject
the TLS handshake and takes the iOS app offline.

## 5. Verify (from your laptop)

```bash
curl -I https://backyamon.com                       # 200
curl -I https://backyamon.com/sw.js                 # 200, Cache-Control: no-cache
curl  https://backyamon.com/socket.io/?EIO=4\&transport=polling       # 0{"sid":...}
curl  https://api.backyamon.com/socket.io/?EIO=4\&transport=polling   # 0{"sid":...} (iOS app)
```

Then open `https://backyamon.com`, DevTools → Application → Service Workers
(should be activated), and test a multiplayer game.

## 6. Decommission the old hosts

Once `backyamon.com` is verified:

- **Vercel** — remove the `backyamon.com` / `www` domains from the project (so it
  stops trying to serve them), or delete the project. Drop the now-unused
  `NEXT_PUBLIC_SERVER_URL` env there.
- **Render** — delete the `backyamon` service (it's the old, sleeping server).

## Redeploying later

```bash
git pull
docker compose up -d --build      # rebuilds changed images, recreates containers
docker image prune -f             # optional: clean old layers
```

> The frontend's server URL is baked in at build time (build arg in
> `docker-compose.yml`). If you change it, you must rebuild the `web` image, not
> just restart it.

## Backups (SQLite → R2 via Litestream)

The DB is a file at `./data/backyamon.db`. The `litestream` container (in
`docker-compose.yml`) continuously replicates it to the **`backyamon-backups`**
R2 bucket — offsite, with point-in-time recovery. It reuses the `R2_*` creds
from `.env`, so once those are set it just works after `docker compose up -d`.

Verify it's replicating:
```bash
docker compose logs litestream        # should show "replicating to" / sync activity
```

**Restore** (on a fresh box, before starting the server):
```bash
docker compose run --rm litestream restore -o /data/backyamon.db /data/backyamon.db
docker compose up -d
```

> Litestream needs the DB in WAL mode — Backyamon already uses WAL, so nothing
> to do. If you ever drop Litestream, a simple offline alternative is a nightly
> `sqlite3 ... ".backup ..."` cron, but that leaves backups on the same disk.
