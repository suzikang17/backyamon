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
    <main className="min-h-screen bg-[#2C1B0E] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
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
            <span className="text-[#CE1126] text-sm font-heading">
              {error}
            </span>
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
