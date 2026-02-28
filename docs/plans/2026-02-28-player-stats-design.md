# Player Stats & Match History Design

## Goal

Build out W/L records, matchup history, and player profiles so players can see their stats, recent matches, and head-to-head records against opponents.

## Architecture

All stats are derived from the existing `matches` table via SQL queries — no schema changes needed. Two new socket events provide the data. A new `/player/[username]` page shows detailed stats. The lobby gets a recent matches feed. Usernames become clickable links everywhere.

## Data Layer

No schema changes. The existing `matches` table already stores both player IDs, winner, win type, points, and timestamps.

### New Socket Events

**`get-player-profile`** (input: `{ username }`)

Returns:
- `username`, `wins`, `losses`, `winPct`
- `recentMatches` — last 20 matches with opponent username, result, win type, points, date
- `headToHead` — aggregated record against each opponent: `{ opponentUsername, wins, losses }`

**`get-recent-matches`** (input: `{ limit? }`)

Returns:
- Last 10 completed matches across all players (for lobby feed)
- Each entry: gold username, red username, winner username, win type, points, date

Both use `emitWithAck` callback pattern matching existing asset events.

## Frontend

### New Page: `/player/[username]`

- Header: username + overall record (e.g. "sz1 — 5W 2L (71%)")
- Recent Matches table: last 20 matches, each row showing opponent, result (W/L), win type badge, points, relative date
- Head-to-Head section: list of opponents with record against each, sorted by most games played
- Usernames in match list are clickable links to other profiles

### Lobby Additions

- "Recent Matches" section below the registered players grid
- Shows last 10 matches server-wide as a compact feed (e.g. "sz1 beat RastaMaster — ya mon — 2 pts")
- Each username is a clickable link

### Clickable Usernames Everywhere

- Reusable `<PlayerLink>` component wrapping username with link to `/player/[username]`
- Used in: lobby player list, lobby match feed, player profile match history, in-game opponent display
