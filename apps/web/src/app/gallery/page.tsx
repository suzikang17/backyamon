"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SocketClient } from "@/multiplayer/SocketClient";
import {
  getAssetPreferences,
  setAssetPreference,
  type AssetPreferences,
} from "@/lib/assetPreferences";

// ── Types ────────────────────────────────────────────────────────────────

type AssetType = "piece" | "sfx" | "music";
type TabFilter = "all" | AssetType;

interface GalleryAsset {
  id: string;
  creatorId: string;
  type: AssetType;
  title: string;
  status: "published";
  metadata: string;
  r2Key: string | null;
  url: string | null;
  createdAt: number;
  updatedAt: number;
}

interface PieceMetadata {
  svg_gold: string;
  svg_red: string;
}

interface SfxMetadata {
  slot: string;
  duration_ms: number;
  file_size: number;
}

interface MusicMetadata {
  duration_ms: number;
  file_size: number;
}

const REPORT_REASONS = ["inappropriate", "offensive", "spam"] as const;

const TABS: { key: TabFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "piece", label: "Pieces" },
  { key: "sfx", label: "Sound Effects" },
  { key: "music", label: "Music" },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function isEquipped(asset: GalleryAsset, prefs: AssetPreferences): boolean {
  if (asset.type === "piece") {
    return prefs.pieceSet === asset.id;
  }
  if (asset.type === "sfx") {
    try {
      const meta = JSON.parse(asset.metadata) as SfxMetadata;
      return prefs.sfx?.[meta.slot] === asset.id;
    } catch {
      return false;
    }
  }
  if (asset.type === "music") {
    return prefs.music === asset.id;
  }
  return false;
}

// ── Component ────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const socketRef = useRef<SocketClient | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [connecting, setConnecting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [prefs, setPrefs] = useState<AssetPreferences>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [reportOpenId, setReportOpenId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  // ── Load prefs from localStorage ──────────────────────────────────────
  useEffect(() => {
    setPrefs(getAssetPreferences());
  }, []);

  // ── Socket connection ─────────────────────────────────────────────────
  useEffect(() => {
    const client = new SocketClient();
    socketRef.current = client;

    (async () => {
      setConnecting(true);
      setError("");

      try {
        await client.connect({ maxRetries: 5 });
        await client.register();
        setConnecting(false);

        const result = await client.listGallery();
        setAssets(result.assets as GalleryAsset[]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to connect to server",
        );
        setConnecting(false);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      client.destroy();
      socketRef.current = null;
    };
  }, []);

  // ── Clean up audio on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ── Filtered assets ───────────────────────────────────────────────────
  const filteredAssets =
    activeTab === "all" ? assets : assets.filter((a) => a.type === activeTab);

  // ── Equip handler ─────────────────────────────────────────────────────
  const handleEquip = useCallback(
    (asset: GalleryAsset) => {
      if (asset.type === "piece") {
        setAssetPreference("pieceSet", asset.id);
      } else if (asset.type === "music") {
        setAssetPreference("music", asset.id);
      } else if (asset.type === "sfx") {
        try {
          const meta = JSON.parse(asset.metadata) as SfxMetadata;
          const currentSfx = prefs.sfx ?? {};
          setAssetPreference("sfx", { ...currentSfx, [meta.slot]: asset.id });
        } catch {
          return;
        }
      }
      setPrefs(getAssetPreferences());
    },
    [prefs],
  );

  // ── Report handler ────────────────────────────────────────────────────
  const handleReport = useCallback(
    async (assetId: string, reason: string) => {
      const client = socketRef.current;
      if (!client) return;

      try {
        await client.reportAsset(assetId, reason);
        setReportedIds((prev) => new Set(prev).add(assetId));
      } catch {
        // Silently handle — not critical
      }
      setReportOpenId(null);
    },
    [],
  );

  // ── Audio playback ────────────────────────────────────────────────────
  const handlePlay = useCallback(
    (asset: GalleryAsset) => {
      // Stop current
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (playingId === asset.id) {
        setPlayingId(null);
        return;
      }

      if (!asset.url) return;

      const audio = new Audio(asset.url);
      audioRef.current = audio;
      audio.addEventListener("ended", () => setPlayingId(null));
      audio.play();
      setPlayingId(asset.id);
    },
    [playingId],
  );

  // ── Render asset preview (matches My Stuff style) ─────────────────────
  const renderAssetPreview = (asset: GalleryAsset) => {
    if (asset.type === "piece") {
      try {
        const meta = JSON.parse(asset.metadata) as PieceMetadata;
        return (
          <div className="w-full h-24 flex items-center justify-center gap-3 bg-[#1A1A0E]/50 rounded-lg overflow-hidden">
            {meta.svg_gold && (
              <div
                className="w-12 h-12 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: meta.svg_gold }}
              />
            )}
            {meta.svg_red && (
              <div
                className="w-12 h-12 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: meta.svg_red }}
              />
            )}
          </div>
        );
      } catch {
        return (
          <div className="w-full h-24 flex items-center justify-center bg-[#1A1A0E]/50 rounded-lg">
            <span className="text-[#D4A857]/40 text-sm font-heading">
              Preview unavailable
            </span>
          </div>
        );
      }
    }

    if (asset.type === "sfx") {
      try {
        const meta = JSON.parse(asset.metadata) as SfxMetadata;
        return (
          <div className="w-full h-24 flex flex-col items-center justify-center bg-[#1A1A0E]/50 rounded-lg gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-[#006B3F] flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-[#006B3F]"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-[#D4A857] text-xs font-heading">
              {formatDuration(meta.duration_ms)} &middot; {meta.slot}
            </span>
          </div>
        );
      } catch {
        return (
          <div className="w-full h-24 flex items-center justify-center bg-[#1A1A0E]/50 rounded-lg">
            <span className="text-[#D4A857]/40 text-sm font-heading">
              Audio
            </span>
          </div>
        );
      }
    }

    if (asset.type === "music") {
      try {
        const meta = JSON.parse(asset.metadata) as MusicMetadata;
        return (
          <div className="w-full h-24 flex flex-col items-center justify-center bg-[#1A1A0E]/50 rounded-lg gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-[#CE1126] flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-[#CE1126]"
                fill="currentColor"
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <span className="text-[#D4A857] text-xs font-heading">
              {formatDuration(meta.duration_ms)}
            </span>
          </div>
        );
      } catch {
        return (
          <div className="w-full h-24 flex items-center justify-center bg-[#1A1A0E]/50 rounded-lg">
            <span className="text-[#D4A857]/40 text-sm font-heading">
              Music
            </span>
          </div>
        );
      }
    }

    return null;
  };

  // ── Render report button ──────────────────────────────────────────────
  const renderReportButton = (asset: GalleryAsset) => {
    const reported = reportedIds.has(asset.id);
    const isOpen = reportOpenId === asset.id;

    if (reported) {
      return (
        <span className="text-[#D4A857]/40 font-heading text-xs px-2 py-1.5">
          Reported
        </span>
      );
    }

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setReportOpenId(isOpen ? null : asset.id)}
          className="rounded-xl px-3 py-1.5 text-xs font-heading font-bold text-[#CE1126]/60 hover:text-[#CE1126] cursor-pointer interactive-btn transition-colors"
        >
          Report
        </button>
        {isOpen && (
          <div className="absolute right-0 bottom-full mb-1 bg-[#1A1A0E] border border-[#8B4513] rounded-lg shadow-lg z-10 min-w-[140px]">
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => handleReport(asset.id, reason)}
                className="block w-full text-left px-3 py-2 text-xs font-heading text-[#F4E1C1] hover:bg-[#2a2a1e] hover:text-[#FFD700] capitalize cursor-pointer transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                {reason}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animated-bg flex min-h-screen flex-col items-center px-4 py-16">
      {/* Rasta stripe decoration - top */}
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-[#006B3F] origin-top" />
        <div className="rasta-segment flex-1 bg-[#FFD700] origin-top" />
        <div className="rasta-segment flex-1 bg-[#CE1126] origin-top" />
      </div>

      {/* Title section */}
      <div className="text-center mb-4 animate-fade-in-up">
        <h1 className="title-glow font-spice text-4xl sm:text-6xl md:text-7xl text-[#FFD700] tracking-wide">
          Gallery
        </h1>
      </div>

      <p className="animate-fade-in animate-delay-100 text-[#D4A857] text-lg mb-6 font-heading">
        Community creations
      </p>

      {/* Connection status */}
      {connecting && (
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFD700] animate-pulse" />
          <span className="text-[#D4A857] text-sm font-heading">
            Connecting to server...
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[#CE1126]/20 border border-[#CE1126] rounded-xl px-6 py-3 mb-4 max-w-md text-center">
          <p className="text-[#CE1126] text-sm font-heading">{error}</p>
        </div>
      )}

      {/* Tab filters */}
      {!connecting && (
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-full text-sm font-heading font-bold transition-all duration-200 cursor-pointer ${
                activeTab === tab.key
                  ? "bg-[#FFD700] text-[#1A1A0E] shadow-[0_0_12px_rgba(255,215,0,0.3)]"
                  : "bg-[#2a2a1e] text-[#D4A857] border border-[#8B4513]/50 hover:border-[#FFD700]/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="w-full max-w-4xl">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="flex gap-2">
              <div
                className="w-3 h-3 rounded-full bg-[#006B3F] animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-3 h-3 rounded-full bg-[#FFD700] animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-3 h-3 rounded-full bg-[#CE1126] animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <p className="text-[#D4A857] font-heading">
              Loading gallery...
            </p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="text-[#D4A857]/60 text-lg font-heading text-center">
              {assets.length === 0
                ? "No published creations yet \u2014 be the first!"
                : "No assets in this category."}
            </p>
            {assets.length === 0 && (
              <Link
                href="/create"
                className="rounded-2xl wood-btn wood-btn-bamboo px-6 py-3 text-lg font-bold text-[#1A1A0E] shadow-lg interactive-btn cursor-pointer font-heading"
              >
                Create Something
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map((asset) => {
              const equipped = isEquipped(asset, prefs);
              return (
                <div
                  key={asset.id}
                  className={`game-card rounded-2xl bg-[#2a2a1e] p-4 flex flex-col gap-3 transition-all duration-200 ${
                    equipped
                      ? "border-2 border-[#FFD700] shadow-[0_0_16px_rgba(255,215,0,0.25)]"
                      : "border border-[#8B4513]/50"
                  }`}
                >
                  {/* Equipped badge */}
                  {equipped && (
                    <div className="flex justify-end -mt-1 -mr-1">
                      <span className="bg-[#FFD700] text-[#1A1A0E] text-xs font-heading font-bold px-2 py-0.5 rounded-full">
                        Equipped
                      </span>
                    </div>
                  )}

                  {/* Preview */}
                  {renderAssetPreview(asset)}

                  {/* Info */}
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[#FFD700] font-heading text-base truncate">
                      {asset.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[#D4A857]/50 text-xs font-heading">
                        {asset.type === "piece"
                          ? "Piece"
                          : asset.type === "sfx"
                            ? "Sound Effect"
                            : "Music"}
                      </span>
                      <span className="text-[#D4A857]/30 text-xs">
                        &middot;
                      </span>
                      <span className="text-[#D4A857]/50 text-xs font-heading">
                        by {asset.creatorId}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-auto pt-2">
                    {/* Play button for audio assets */}
                    {(asset.type === "sfx" || asset.type === "music") &&
                      asset.url && (
                        <button
                          type="button"
                          onClick={() => handlePlay(asset)}
                          className="flex-1 min-w-[70px] rounded-xl px-3 py-1.5 text-xs font-heading font-bold bg-[#1A1A0E] text-[#FFD700] border border-[#8B4513]/40 hover:border-[#FFD700] transition-all duration-200 cursor-pointer"
                        >
                          {playingId === asset.id ? "Stop" : "Play"}
                        </button>
                      )}

                    {/* Equip button */}
                    <button
                      type="button"
                      onClick={() => handleEquip(asset)}
                      className={`flex-1 min-w-[70px] rounded-xl px-3 py-1.5 text-xs font-heading font-bold transition-all duration-200 cursor-pointer ${
                        equipped
                          ? "bg-[#FFD700] text-[#1A1A0E]"
                          : "bg-[#1A1A0E] text-[#FFD700] border border-[#FFD700]/40 hover:border-[#FFD700]"
                      }`}
                    >
                      {equipped ? "Equipped" : "Equip"}
                    </button>

                    {/* Report button */}
                    {renderReportButton(asset)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation links */}
      <div className="flex gap-6 mt-10">
        <Link
          href="/create"
          className="text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-base font-heading interactive-btn"
        >
          Creation Station
        </Link>
        <Link
          href="/my-stuff"
          className="text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-base font-heading interactive-btn"
        >
          My Stuff
        </Link>
      </div>

      <Link
        href="/"
        className="mt-6 text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-lg min-h-[44px] flex items-center interactive-btn font-heading"
      >
        &larr; Back to Menu
      </Link>

      {/* Rasta stripe decoration - bottom */}
      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-[#006B3F] origin-bottom" />
        <div className="rasta-segment flex-1 bg-[#FFD700] origin-bottom" />
        <div className="rasta-segment flex-1 bg-[#CE1126] origin-bottom" />
      </div>
    </div>
  );
}
