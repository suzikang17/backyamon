# Player Stats & Match History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add player profile pages with W/L records, match history, head-to-head stats, and clickable usernames everywhere.

**Architecture:** Two new socket events (`get-player-profile`, `get-recent-matches`) query the existing `matches` table. A new `/player/[username]` page displays detailed stats. The lobby gets a recent matches feed. A shared `<PlayerLink>` component makes usernames clickable everywhere.

**Tech Stack:** Socket.io (emitWithAck pattern), Drizzle ORM + Turso, Next.js app router, React, Tailwind CSS

---

### Task 1: Add `get-player-profile` socket event on server

**Files:**
- Modify: `apps/server/src/index.ts` (after the `list-players` handler around line 263)

**Step 1: Add the `get-player-profile` handler**

Add this handler inside the `io.on("connection")` block, after the existing `list-players` handler (line 263):

```typescript
socket.on(
  "get-player-profile",
  async (
    data: { username: string },
    callback: (res: Record<string, unknown>) => void,
  ) => {
    if (!data?.username) return callback({ error: "Username required" });

    const guest = await db
      .select()
      .from(guests)
      .where(eq(guests.username, data.username.trim()))
      .get();

    if (!guest) return callback({ error: "Player not found" });

    const playerId = guest.id;

    // Overall W/L
    const [winsResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(matches)
      .where(eq(matches.winnerId, playerId))
      .all();

    const [lossesResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(matches)
      .where(
        and(
          sql`(${matches.goldPlayerId} = ${playerId} OR ${matches.redPlayerId} = ${playerId})`,
          sql`${matches.winnerId} IS NOT NULL`,
          sql`${matches.winnerId} != ${playerId}`,
        ),
      )
      .all();

    const wins = winsResult?.count ?? 0;
    const losses = lossesResult?.count ?? 0;
    const total = wins + losses;
    const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Recent matches (last 20)
    const recentRows = await db
      .select({
        id: matches.id,
        goldPlayerId: matches.goldPlayerId,
        redPlayerId: matches.redPlayerId,
        winnerId: matches.winnerId,
        winType: matches.winType,
        pointsWon: matches.pointsWon,
        completedAt: matches.completedAt,
      })
      .from(matches)
      .where(
        sql`(${matches.goldPlayerId} = ${playerId} OR ${matches.redPlayerId} = ${playerId})`,
      )
      .orderBy(desc(matches.completedAt))
      .limit(20)
      .all();

    // Resolve opponent usernames
    const opponentIds = new Set<string>();
    for (const m of recentRows) {
      const oppId = m.goldPlayerId === playerId ? m.redPlayerId : m.goldPlayerId;
      opponentIds.add(oppId);
    }

    const opponentMap = new Map<string, string>();
    if (opponentIds.size > 0) {
      const opponentRows = await db
        .select({ id: guests.id, username: guests.username, displayName: guests.displayName })
        .from(guests)
        .where(sql`${guests.id} IN (${sql.join([...opponentIds].map(id => sql`${id}`), sql`, `)})`)
        .all();
      for (const row of opponentRows) {
        opponentMap.set(row.id, row.username ?? row.displayName);
      }
    }

    const recentMatches = recentRows.map((m) => {
      const oppId = m.goldPlayerId === playerId ? m.redPlayerId : m.goldPlayerId;
      return {
        id: m.id,
        opponent: opponentMap.get(oppId) ?? "Unknown",
        result: m.winnerId === playerId ? "win" : "loss",
        winType: m.winType,
        pointsWon: m.pointsWon,
        completedAt: m.completedAt,
      };
    });

    // Head-to-head aggregation
    const h2hMap = new Map<string, { wins: number; losses: number }>();
    for (const m of recentRows) {
      const oppId = m.goldPlayerId === playerId ? m.redPlayerId : m.goldPlayerId;
      const oppName = opponentMap.get(oppId) ?? "Unknown";
      if (!h2hMap.has(oppName)) h2hMap.set(oppName, { wins: 0, losses: 0 });
      const entry = h2hMap.get(oppName)!;
      if (m.winnerId === playerId) entry.wins++;
      else entry.losses++;
    }

    // Actually get full head-to-head from ALL matches, not just recent 20
    const allMatchRows = await db
      .select({
        goldPlayerId: matches.goldPlayerId,
        redPlayerId: matches.redPlayerId,
        winnerId: matches.winnerId,
      })
      .from(matches)
      .where(
        sql`(${matches.goldPlayerId} = ${playerId} OR ${matches.redPlayerId} = ${playerId})`,
      )
      .all();

    const fullH2h = new Map<string, { wins: number; losses: number }>();
    const allOppIds = new Set<string>();
    for (const m of allMatchRows) {
      const oppId = m.goldPlayerId === playerId ? m.redPlayerId : m.goldPlayerId;
      allOppIds.add(oppId);
    }

    // Resolve all opponent names
    if (allOppIds.size > 0) {
      const allOppRows = await db
        .select({ id: guests.id, username: guests.username, displayName: guests.displayName })
        .from(guests)
        .where(sql`${guests.id} IN (${sql.join([...allOppIds].map(id => sql`${id}`), sql`, `)})`)
        .all();
      for (const row of allOppRows) {
        opponentMap.set(row.id, row.username ?? row.displayName);
      }
    }

    for (const m of allMatchRows) {
      const oppId = m.goldPlayerId === playerId ? m.redPlayerId : m.goldPlayerId;
      const oppName = opponentMap.get(oppId) ?? "Unknown";
      if (!fullH2h.has(oppName)) fullH2h.set(oppName, { wins: 0, losses: 0 });
      const entry = fullH2h.get(oppName)!;
      if (m.winnerId === playerId) entry.wins++;
      else entry.losses++;
    }

    const headToHead = [...fullH2h.entries()]
      .map(([opponent, record]) => ({
        opponent,
        wins: record.wins,
        losses: record.losses,
      }))
      .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

    callback({
      username: data.username.trim(),
      wins,
      losses,
      winPct,
      recentMatches,
      headToHead,
    });
  },
);
```

**Step 2: Build and verify no type errors**

Run: `cd apps/server && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat: add get-player-profile socket event"
```

---

### Task 2: Add `get-recent-matches` socket event on server

**Files:**
- Modify: `apps/server/src/index.ts` (after the new `get-player-profile` handler)

**Step 1: Add the `get-recent-matches` handler**

Add this handler right after the `get-player-profile` handler:

```typescript
socket.on(
  "get-recent-matches",
  async (
    data: { limit?: number },
    callback: (res: Record<string, unknown>) => void,
  ) => {
    const limit = Math.min(data?.limit ?? 10, 50);

    const rows = await db
      .select({
        id: matches.id,
        goldPlayerId: matches.goldPlayerId,
        redPlayerId: matches.redPlayerId,
        winnerId: matches.winnerId,
        winType: matches.winType,
        pointsWon: matches.pointsWon,
        completedAt: matches.completedAt,
      })
      .from(matches)
      .where(sql`${matches.winnerId} IS NOT NULL`)
      .orderBy(desc(matches.completedAt))
      .limit(limit)
      .all();

    // Resolve all player usernames
    const playerIds = new Set<string>();
    for (const m of rows) {
      playerIds.add(m.goldPlayerId);
      playerIds.add(m.redPlayerId);
    }

    const nameMap = new Map<string, string>();
    if (playerIds.size > 0) {
      const playerRows = await db
        .select({ id: guests.id, username: guests.username, displayName: guests.displayName })
        .from(guests)
        .where(sql`${guests.id} IN (${sql.join([...playerIds].map(id => sql`${id}`), sql`, `)})`)
        .all();
      for (const row of playerRows) {
        nameMap.set(row.id, row.username ?? row.displayName);
      }
    }

    const recentMatches = rows.map((m) => ({
      id: m.id,
      goldPlayer: nameMap.get(m.goldPlayerId) ?? "Unknown",
      redPlayer: nameMap.get(m.redPlayerId) ?? "Unknown",
      winner: nameMap.get(m.winnerId!) ?? "Unknown",
      winType: m.winType,
      pointsWon: m.pointsWon,
      completedAt: m.completedAt,
    }));

    callback({ matches: recentMatches });
  },
);
```

**Step 2: Build and verify no type errors**

Run: `cd apps/server && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat: add get-recent-matches socket event"
```

---

### Task 3: Add client methods to SocketClient

**Files:**
- Modify: `apps/web/src/multiplayer/SocketClient.ts` (add methods after `listRooms` around line 275)

**Step 1: Add `getPlayerProfile` and `getRecentMatches` methods**

Add these methods after the `listRooms()` method (around line 275):

```typescript
getPlayerProfile(username: string): Promise<{
  username: string;
  wins: number;
  losses: number;
  winPct: number;
  recentMatches: {
    id: string;
    opponent: string;
    result: "win" | "loss";
    winType: string;
    pointsWon: number;
    completedAt: string;
  }[];
  headToHead: {
    opponent: string;
    wins: number;
    losses: number;
  }[];
}> {
  return this.emitWithAck("get-player-profile", { username });
}

getRecentMatches(limit?: number): Promise<{
  matches: {
    id: string;
    goldPlayer: string;
    redPlayer: string;
    winner: string;
    winType: string;
    pointsWon: number;
    completedAt: string;
  }[];
}> {
  return this.emitWithAck("get-recent-matches", { limit });
}
```

**Step 2: Build and verify no type errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/multiplayer/SocketClient.ts
git commit -m "feat: add getPlayerProfile and getRecentMatches client methods"
```

---

### Task 4: Create `<PlayerLink>` component

**Files:**
- Create: `apps/web/src/components/PlayerLink.tsx`

**Step 1: Create the component**

```tsx
import Link from "next/link";

interface PlayerLinkProps {
  username: string;
  className?: string;
}

export function PlayerLink({ username, className }: PlayerLinkProps) {
  return (
    <Link
      href={`/player/${encodeURIComponent(username)}`}
      className={`hover:underline cursor-pointer ${className ?? "text-[#FFD700] font-heading"}`}
    >
      {username}
    </Link>
  );
}
```

**Step 2: Build and verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/components/PlayerLink.tsx
git commit -m "feat: add PlayerLink component for clickable usernames"
```

---

### Task 5: Create `/player/[username]` profile page

**Files:**
- Create: `apps/web/src/app/player/[username]/page.tsx`

**Step 1: Create the profile page**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SocketClient } from "@/multiplayer/SocketClient";
import { PlayerLink } from "@/components/PlayerLink";

interface MatchEntry {
  id: string;
  opponent: string;
  result: "win" | "loss";
  winType: string;
  pointsWon: number;
  completedAt: string;
}

interface H2HEntry {
  opponent: string;
  wins: number;
  losses: number;
}

interface ProfileData {
  username: string;
  wins: number;
  losses: number;
  winPct: number;
  recentMatches: MatchEntry[];
  headToHead: H2HEntry[];
}

function formatWinType(winType: string): string {
  switch (winType) {
    case "ya_mon":
      return "Ya Mon";
    case "big_ya_mon":
      return "Big Ya Mon";
    case "massive_ya_mon":
      return "Massive Ya Mon";
    default:
      return winType;
  }
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function PlayerProfilePage() {
  const params = useParams();
  const username = decodeURIComponent(params.username as string);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const clientRef = useRef<SocketClient | null>(null);

  const fetchProfile = useCallback(async (client: SocketClient) => {
    try {
      const data = await client.getPlayerProfile(username);
      setProfile(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    const client = new SocketClient();
    clientRef.current = client;

    client
      .connect()
      .then(() => client.register())
      .then(() => fetchProfile(client))
      .catch(() => {
        setError("Could not connect to server");
        setLoading(false);
      });

    return () => {
      client.destroy();
    };
  }, [fetchProfile]);

  return (
    <main className="min-h-screen bg-[#2C1B0E] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Back link */}
        <Link
          href="/lobby"
          className="text-[#D4A857]/60 text-sm font-heading hover:text-[#D4A857] transition-colors"
        >
          &larr; Back to Lobby
        </Link>

        {loading && (
          <div className="mt-12 text-center">
            <span className="text-[#D4A857] text-sm font-heading animate-pulse">
              Loading profile...
            </span>
          </div>
        )}

        {error && (
          <div className="mt-12 text-center">
            <span className="text-[#CE1126] text-sm font-heading">{error}</span>
          </div>
        )}

        {profile && (
          <>
            {/* Header */}
            <div className="mt-6 text-center">
              <h1 className="font-heading text-4xl text-[#FFD700] tracking-wide">
                {profile.username}
              </h1>
              <p className="mt-2 font-heading text-lg text-[#D4A857]">
                {profile.wins}W - {profile.losses}L
                {profile.wins + profile.losses > 0 && (
                  <span className="text-[#D4A857]/50 ml-2">
                    ({profile.winPct}%)
                  </span>
                )}
              </p>
            </div>

            {/* Recent Matches */}
            <div className="mt-8">
              <h2 className="text-[#D4A857] text-xs font-heading tracking-wider uppercase mb-3">
                Recent Matches
              </h2>
              {profile.recentMatches.length === 0 ? (
                <p className="text-[#D4A857]/40 text-sm font-heading">
                  No matches played yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {profile.recentMatches.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl bg-[#1A1A0E]/80 border border-[#8B4513]/40 px-4 py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-heading text-xs font-bold px-2 py-0.5 rounded ${
                            m.result === "win"
                              ? "bg-[#006B3F]/30 text-[#00FF88]"
                              : "bg-[#CE1126]/20 text-[#CE1126]"
                          }`}
                        >
                          {m.result === "win" ? "W" : "L"}
                        </span>
                        <span className="text-[#D4A857] text-sm font-heading">
                          vs{" "}
                          <PlayerLink
                            username={m.opponent}
                            className="text-[#FFD700] font-heading text-sm"
                          />
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#D4A857]/50 text-xs font-heading">
                          {formatWinType(m.winType)}
                        </span>
                        <span className="text-[#D4A857]/50 text-xs font-heading">
                          {m.pointsWon} pts
                        </span>
                        <span className="text-[#D4A857]/30 text-xs font-heading">
                          {timeAgo(m.completedAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Head-to-Head */}
            {profile.headToHead.length > 0 && (
              <div className="mt-8">
                <h2 className="text-[#D4A857] text-xs font-heading tracking-wider uppercase mb-3">
                  Head-to-Head
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profile.headToHead.map((h) => (
                    <div
                      key={h.opponent}
                      className="rounded-xl bg-[#1A1A0E]/80 border border-[#8B4513]/40 px-4 py-3 flex items-center justify-between"
                    >
                      <PlayerLink
                        username={h.opponent}
                        className="text-[#FFD700] font-heading text-sm"
                      />
                      <span className="text-[#D4A857]/50 font-heading text-xs">
                        {h.wins}W - {h.losses}L
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
```

**Step 2: Build and verify**

Run: `npx turbo build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/app/player/\[username\]/page.tsx
git commit -m "feat: add player profile page with stats and match history"
```

---

### Task 6: Add recent matches feed to lobby

**Files:**
- Modify: `apps/web/src/app/lobby/page.tsx`

**Step 1: Add state and fetch logic for recent matches**

Add to the existing state declarations (around line 35):

```typescript
const [recentMatches, setRecentMatches] = useState<{
  id: string;
  goldPlayer: string;
  redPlayer: string;
  winner: string;
  winType: string;
  pointsWon: number;
  completedAt: string;
}[]>([]);
```

Add import for `PlayerLink` at the top of the file:

```typescript
import { PlayerLink } from "@/components/PlayerLink";
```

In the `setupConnection` function (where `client.listPlayers()` is called), add:

```typescript
client.getRecentMatches(10).then((data) => {
  setRecentMatches(data.matches);
}).catch(() => {});
```

**Step 2: Add the recent matches section to the JSX**

After the "Registered Players" section (after its closing `</div>` around line 496), add:

```tsx
{/* Recent Matches Feed */}
{view === "lobby" && recentMatches.length > 0 && (
  <div className="w-full max-w-3xl mt-8">
    <p className="text-[#D4A857] text-xs font-heading text-center tracking-wider uppercase mb-3">
      Recent Matches
    </p>
    <div className="flex flex-col gap-1.5">
      {recentMatches.map((m) => (
        <div
          key={m.id}
          className="rounded-lg bg-[#1A1A0E]/60 border border-[#8B4513]/30 px-3 py-2 flex items-center justify-center gap-2 text-sm font-heading"
        >
          <PlayerLink
            username={m.winner}
            className="text-[#FFD700] font-heading text-sm"
          />
          <span className="text-[#D4A857]/50">beat</span>
          <PlayerLink
            username={m.winner === m.goldPlayer ? m.redPlayer : m.goldPlayer}
            className="text-[#D4A857] font-heading text-sm"
          />
          <span className="text-[#D4A857]/30">—</span>
          <span className="text-[#D4A857]/40 text-xs">
            {m.winType === "ya_mon" ? "Ya Mon" : m.winType === "big_ya_mon" ? "Big Ya Mon" : "Massive Ya Mon"}
          </span>
          <span className="text-[#D4A857]/40 text-xs">
            {m.pointsWon} pts
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 3: Use `<PlayerLink>` in the existing Registered Players grid**

Replace the username `<span>` inside the players grid (around line 487):

From:
```tsx
<span className="text-[#FFD700] font-heading text-sm block">
  {p.username}
</span>
```

To:
```tsx
<PlayerLink
  username={p.username}
  className="text-[#FFD700] font-heading text-sm block"
/>
```

**Step 4: Build and verify**

Run: `npx turbo build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add apps/web/src/app/lobby/page.tsx
git commit -m "feat: add recent matches feed and clickable usernames in lobby"
```

---

### Task 7: Make opponent name clickable in game view

**Files:**
- Modify: `apps/web/src/app/play/page.tsx` (around line 390)

**Step 1: Import PlayerLink**

Add to imports at the top of the file:

```typescript
import { PlayerLink } from "@/components/PlayerLink";
```

**Step 2: Replace opponent name span with PlayerLink**

In the game header (around line 388), replace:

```tsx
<span className="text-[#CE1126]">{opponentName}</span>
```

With:

```tsx
<PlayerLink
  username={opponentName}
  className="text-[#CE1126] font-heading"
/>
```

**Step 3: Build and verify**

Run: `npx turbo build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/web/src/app/play/page.tsx
git commit -m "feat: make opponent name clickable in game view"
```
