# Deploying Backyamon to the VPS

Everything runs on one box under `backyamon.com`: the Next.js frontend and the
Socket.IO server as Docker containers, with host **nginx** terminating TLS and
reverse-proxying to them. Same origin → no CORS, one deploy, one domain.

```
                         ┌─────────── VPS (host nginx) ───────────┐
  backyamon.com  ──────▶ │  :443  ─┬─ /socket.io/ ─▶ server :3001  │
  www.backyamon.com ───▶ │         └─ /*           ─▶ web    :3000 │
  api.backyamon.com ───▶ │  :443  ──────────────── ─▶ server :3001 │ (iOS app, unchanged)
                         └────────────────────────────────────────┘
                          DB → SQLite (./data volume)   Assets → Cloudflare R2
```

## 1. DNS (Cloudflare)

Add records pointing the apex + www at the VPS. Set them to **DNS only (grey
cloud)** so certbot can issue certs and nginx serves TLS directly:

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

## 4. nginx + TLS

```bash
sudo cp deploy/nginx/backyamon.com.conf /etc/nginx/sites-available/backyamon.com
sudo ln -s /etc/nginx/sites-available/backyamon.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo certbot --nginx -d backyamon.com -d www.backyamon.com    # issues + wires TLS
sudo systemctl reload nginx
```

## 5. Verify (from your laptop)

```bash
curl -I https://backyamon.com                       # 200
curl -I https://backyamon.com/sw.js                 # 200, Cache-Control: no-cache
curl  https://backyamon.com/socket.io/?EIO=4\&transport=polling   # 0{"sid":...}
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

## Backups (SQLite)

The DB is a file at `./data/backyamon.db` on the VPS. With local SQLite you own
backups — a nightly cron is enough:

```bash
# crontab -e
0 4 * * *  sqlite3 /path/to/backyamon/data/backyamon.db ".backup '/path/to/backups/by-$(date +\%F).db'" && find /path/to/backups -name 'by-*.db' -mtime +14 -delete
```

`.backup` is safe to run on a live DB (no need to stop the server). Keeps 14 days.
