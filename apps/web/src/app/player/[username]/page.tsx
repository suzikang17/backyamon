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

  const fetchProfile = useCallback(
    async (client: SocketClient) => {
      try {
        const data = await client.getPlayerProfile(username);
        setProfile(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load profile",
        );
      } finally {
        setLoading(false);
      }
    },
    [username],
  );

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
    <main className="animated-bg min-h-screen flex flex-col items-center px-4 py-8">
      {/* Rasta stripe — top */}
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-green origin-top" />
        <div className="rasta-segment flex-1 bg-gold origin-top" />
        <div className="rasta-segment flex-1 bg-red origin-top" />
      </div>

      <div className="w-full max-w-2xl pt-4">
        <Link
          href="/lobby"
          className="text-gold-dim/60 text-sm font-heading hover:text-gold-dim transition-colors"
        >
          &larr; Back to Lobby
        </Link>

        {loading && (
          <div className="mt-12 flex flex-col items-center gap-4">
            <div className="flex gap-2" role="status" aria-label="Loading profile">
              <div className="w-3 h-3 rounded-full bg-green rasta-dot" style={{ animationDelay: "0ms" }} />
              <div className="w-3 h-3 rounded-full bg-gold rasta-dot" style={{ animationDelay: "0.2s" }} />
              <div className="w-3 h-3 rounded-full bg-red rasta-dot" style={{ animationDelay: "0.4s" }} />
            </div>
            <span className="text-gold-dim text-sm font-heading">
              Loading profile...
            </span>
          </div>
        )}

        {error && (
          <div className="mt-12 text-center">
            <span className="text-red text-sm font-heading">
              {error}
            </span>
          </div>
        )}

        {profile && (
          <>
            {/* Header */}
            <div className="mt-6 text-center">
              <h1 className="title-glow font-display text-4xl sm:text-5xl text-gold tracking-wide">
                {profile.username}
              </h1>
              <p className="mt-2 font-heading text-lg text-gold-dim">
                {profile.wins}W &ndash; {profile.losses}L
                {profile.wins + profile.losses > 0 && (
                  <span className="text-gold-dim/50 ml-2">
                    ({profile.winPct}%)
                  </span>
                )}
              </p>
            </div>

            {/* Recent Matches */}
            <div className="mt-8">
              <h2 className="text-gold-dim text-xs font-heading tracking-wider uppercase mb-3">
                Recent Matches
              </h2>
              {profile.recentMatches.length === 0 ? (
                <p className="text-gold-dim/40 text-sm font-heading">
                  No matches played yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {profile.recentMatches.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl bg-night/80 border border-wood/40 px-4 py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-heading text-xs font-bold px-2 py-0.5 rounded ${
                            m.result === "win"
                              ? "bg-green/30 text-green"
                              : "bg-red/20 text-red"
                          }`}
                        >
                          {m.result === "win" ? "W" : "L"}
                        </span>
                        <span className="text-gold-dim text-sm font-heading">
                          vs{" "}
                          <PlayerLink
                            username={m.opponent}
                            className="text-gold font-heading text-sm"
                          />
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gold-dim/50 text-xs font-heading">
                          {formatWinType(m.winType)}
                        </span>
                        <span className="text-gold-dim/50 text-xs font-heading">
                          {m.pointsWon} pts
                        </span>
                        <span className="text-gold-dim/30 text-xs font-heading">
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
                <h2 className="text-gold-dim text-xs font-heading tracking-wider uppercase mb-3">
                  Head-to-Head
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profile.headToHead.map((h) => (
                    <div
                      key={h.opponent}
                      className="rounded-xl bg-night/80 border border-wood/40 px-4 py-3 flex items-center justify-between"
                    >
                      <PlayerLink
                        username={h.opponent}
                        className="text-gold font-heading text-sm"
                      />
                      <span className="text-gold-dim/50 font-heading text-xs">
                        {h.wins}-{h.losses}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Rasta stripe — bottom */}
      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-green origin-bottom" />
        <div className="rasta-segment flex-1 bg-gold origin-bottom" />
        <div className="rasta-segment flex-1 bg-red origin-bottom" />
      </div>
    </main>
  );
}
