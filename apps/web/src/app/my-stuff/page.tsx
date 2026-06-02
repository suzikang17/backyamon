"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { SocketClient } from "@/multiplayer/SocketClient";
import {
  getAssetPreferences,
  setAssetPreference,
  clearAssetPreference,
  type AssetPreferences,
} from "@/lib/assetPreferences";

interface Asset {
  id: string;
  creatorId: string;
  type: "piece" | "sfx" | "music";
  title: string;
  status: "private" | "published" | "removed";
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

type TabFilter = "all" | "piece" | "sfx" | "music";

const TABS: { key: TabFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "piece", label: "Pieces" },
  { key: "sfx", label: "Sound Effects" },
  { key: "music", label: "Music" },
];

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isEquipped(asset: Asset, prefs: AssetPreferences): boolean {
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

export default function MyStuffPage() {
  const socketRef = useRef<SocketClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [prefs, setPrefs] = useState<AssetPreferences>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState<{
    attempt: number;
    max: number;
  } | null>(null);

  const loadAssets = useCallback(async (client: SocketClient) => {
    setLoading(true);
    try {
      const result = await client.listMyAssets();
      setAssets(result.assets as Asset[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load assets",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPrefs(getAssetPreferences());
  }, []);

  useEffect(() => {
    const client = new SocketClient();
    socketRef.current = client;

    client.on("disconnect", () => {
      setConnected(false);
    });

    client.on("connect", () => {
      setConnected(true);
    });

    (async () => {
      setConnecting(true);
      setError("");
      setRetryInfo(null);

      try {
        await client.connect({
          maxRetries: 5,
          onRetry: (attempt, max) => {
            setRetryInfo({ attempt, max });
          },
        });
        setRetryInfo(null);
        setConnected(true);
        await client.register();
        setConnecting(false);
        await loadAssets(client);
      } catch (err) {
        setRetryInfo(null);
        setError(
          err instanceof Error ? err.message : "Failed to connect to server",
        );
        setConnecting(false);
        setLoading(false);
      }
    })();

    return () => {
      client.destroy();
      socketRef.current = null;
    };
  }, [loadAssets]);

  const handleEquipToggle = useCallback(
    (asset: Asset) => {
      const equipped = isEquipped(asset, prefs);

      if (asset.type === "piece") {
        if (equipped) {
          clearAssetPreference("pieceSet");
        } else {
          setAssetPreference("pieceSet", asset.id);
          // Cache SVG data for use during gameplay
          try {
            const meta = JSON.parse(asset.metadata) as PieceMetadata;
            if (meta.svg_gold && meta.svg_red) {
              localStorage.setItem(
                `backyamon_piece_${asset.id}`,
                JSON.stringify({ svg_gold: meta.svg_gold, svg_red: meta.svg_red }),
              );
            }
          } catch { /* ignore */ }
        }
      } else if (asset.type === "sfx") {
        try {
          const meta = JSON.parse(asset.metadata) as SfxMetadata;
          const currentSfx = prefs.sfx ?? {};
          if (equipped) {
            const updated = { ...currentSfx };
            delete updated[meta.slot];
            if (Object.keys(updated).length === 0) {
              clearAssetPreference("sfx");
            } else {
              setAssetPreference("sfx", updated);
            }
          } else {
            setAssetPreference("sfx", { ...currentSfx, [meta.slot]: asset.id });
            if (asset.url) {
              localStorage.setItem(`backyamon_audio_${asset.id}`, asset.url);
            }
          }
        } catch {
          return;
        }
      } else if (asset.type === "music") {
        if (equipped) {
          clearAssetPreference("music");
        } else {
          setAssetPreference("music", asset.id);
          if (asset.url) {
            localStorage.setItem(`backyamon_audio_${asset.id}`, asset.url);
          }
        }
      }

      setPrefs(getAssetPreferences());
    },
    [prefs],
  );

  const handlePublish = useCallback(async (assetId: string) => {
    const client = socketRef.current;
    if (!client) return;

    try {
      await client.publishAsset(assetId);
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, status: "published" as const } : a,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to publish asset",
      );
    }
  }, []);

  const handleDelete = useCallback(async (assetId: string) => {
    const client = socketRef.current;
    if (!client) return;

    try {
      await client.deleteAsset(assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete asset",
      );
    }
  }, []);

  const filteredAssets =
    activeTab === "all" ? assets : assets.filter((a) => a.type === activeTab);

  const renderAssetPreview = (asset: Asset) => {
    if (asset.type === "piece") {
      try {
        const meta = JSON.parse(asset.metadata) as PieceMetadata;
        return (
          <div className="w-full h-24 flex items-center justify-center bg-night/50 rounded-lg overflow-hidden">
            <img
              src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(meta.svg_gold)))}`}
              alt="Piece preview"
              loading="lazy"
              className="w-16 h-16 object-contain"
            />
          </div>
        );
      } catch {
        return (
          <div className="w-full h-24 flex items-center justify-center bg-night/50 rounded-lg">
            <span className="text-gold-dim/40 text-sm font-heading">
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
          <div className="w-full h-24 flex flex-col items-center justify-center bg-night/50 rounded-lg gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-green flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-green"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-gold-dim text-xs font-heading">
              {formatDuration(meta.duration_ms)} &middot; {meta.slot}
            </span>
          </div>
        );
      } catch {
        return (
          <div className="w-full h-24 flex items-center justify-center bg-night/50 rounded-lg">
            <span className="text-gold-dim/40 text-sm font-heading">
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
          <div className="w-full h-24 flex flex-col items-center justify-center bg-night/50 rounded-lg gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-red flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-red"
                fill="currentColor"
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <span className="text-gold-dim text-xs font-heading">
              {formatDuration(meta.duration_ms)}
            </span>
          </div>
        );
      } catch {
        return (
          <div className="w-full h-24 flex items-center justify-center bg-night/50 rounded-lg">
            <span className="text-gold-dim/40 text-sm font-heading">
              Music
            </span>
          </div>
        );
      }
    }

    return null;
  };

  return (
    <div className="animated-bg flex min-h-screen flex-col items-center px-4 pt-20 pb-16">
      {/* Rasta stripe decoration - top */}
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-green origin-top" />
        <div className="rasta-segment flex-1 bg-gold origin-top" />
        <div className="rasta-segment flex-1 bg-red origin-top" />
      </div>

      {/* Title */}
      <div className="text-center mb-4 animate-fade-in-up">
        <h1 className="title-glow font-spice text-4xl sm:text-6xl md:text-7xl text-gold tracking-wide">
          My Stuff
        </h1>
      </div>

      <p className="animate-fade-in animate-delay-100 text-gold-dim text-lg mb-6 font-heading">
        Your personal collection
      </p>

      {/* Connection status */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            connected
              ? "bg-green"
              : retryInfo || connecting
                ? "bg-gold animate-pulse"
                : "bg-red"
          }`}
        />
        <span className="text-gold-dim text-sm font-heading">
          {retryInfo
            ? `Server waking up... (${retryInfo.attempt}/${retryInfo.max})`
            : connecting
              ? "Connecting..."
              : connected
                ? "Connected"
                : "Disconnected"}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red/20 border border-red rounded-xl px-6 py-3 mb-4 max-w-md text-center">
          <p className="text-red text-sm font-heading">{error}</p>
        </div>
      )}

      {/* Tab filters */}
      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-full text-sm font-heading font-bold transition-all duration-200 cursor-pointer ${
              activeTab === tab.key
                ? "bg-gold text-night shadow-[0_0_12px_rgba(255,215,0,0.3)]"
                : "bg-surface text-gold-dim border border-wood/50 hover:border-gold/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="w-full max-w-4xl">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="flex gap-2" role="status" aria-label="Loading your stuff">
              <div className="w-3 h-3 rounded-full bg-green rasta-dot" style={{ animationDelay: "0ms" }} />
              <div className="w-3 h-3 rounded-full bg-gold rasta-dot" style={{ animationDelay: "0.2s" }} />
              <div className="w-3 h-3 rounded-full bg-red rasta-dot" style={{ animationDelay: "0.4s" }} />
            </div>
            <p className="text-gold-dim font-heading" aria-hidden="true">Loading your stuff...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="text-gold-dim/60 text-lg font-heading text-center">
              {assets.length === 0
                ? "No creations yet \u2014 head to the Creation Station!"
                : "No assets in this category."}
            </p>
            {assets.length === 0 && (
              <Link
                href="/create"
                className="rounded-2xl wood-btn wood-btn-bamboo px-6 py-3 text-lg font-bold text-night shadow-lg interactive-btn cursor-pointer font-heading"
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
                  className={`game-card rounded-2xl bg-surface p-4 flex flex-col gap-3 transition-all duration-200 ${
                    equipped
                      ? "border-2 border-gold shadow-[0_0_16px_rgba(255,215,0,0.25)]"
                      : "border border-wood/50"
                  }`}
                >
                  {/* Equipped badge */}
                  {equipped && (
                    <div className="flex justify-end -mt-1 -mr-1">
                      <span className="bg-gold text-night text-xs font-heading font-bold px-2 py-0.5 rounded-full">
                        Equipped
                      </span>
                    </div>
                  )}

                  {/* Preview */}
                  {renderAssetPreview(asset)}

                  {/* Info */}
                  <div className="flex flex-col gap-1">
                    <h3 className="text-gold font-heading text-base truncate">
                      {asset.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-gold-dim/50 text-xs font-heading">
                        {asset.type === "piece"
                          ? "Piece"
                          : asset.type === "sfx"
                            ? "Sound Effect"
                            : "Music"}
                      </span>
                      <span className="text-gold-dim/30 text-xs">&middot;</span>
                      <span className="text-gold-dim/50 text-xs font-heading">
                        {formatDate(asset.createdAt)}
                      </span>
                    </div>
                    {asset.status === "published" && (
                      <span className="text-green text-xs font-heading font-bold">
                        Published
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-auto pt-2">
                    <button
                      onClick={() => handleEquipToggle(asset)}
                      className={`flex-1 min-w-[70px] rounded-xl px-3 py-1.5 text-xs font-heading font-bold transition-all duration-200 cursor-pointer ${
                        equipped
                          ? "bg-gold text-night"
                          : "bg-night text-gold border border-gold/40 hover:border-gold"
                      }`}
                    >
                      {equipped ? "Unequip" : "Equip"}
                    </button>

                    {asset.status === "private" && (
                      <button
                        onClick={() => handlePublish(asset.id)}
                        className="flex-1 min-w-[70px] rounded-xl px-3 py-1.5 text-xs font-heading font-bold bg-night text-green border border-green/40 hover:border-green transition-all duration-200 cursor-pointer"
                      >
                        Publish
                      </button>
                    )}

                    {confirmDeleteId === asset.id ? (
                      <div className="flex gap-1 flex-1 min-w-[70px]">
                        <button
                          onClick={() => handleDelete(asset.id)}
                          className="flex-1 rounded-xl px-2 py-1.5 text-xs font-heading font-bold bg-red text-white cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 rounded-xl px-2 py-1.5 text-xs font-heading font-bold bg-night text-gold-dim border border-wood/40 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(asset.id)}
                        className="flex-1 min-w-[70px] rounded-xl px-3 py-1.5 text-xs font-heading font-bold bg-night text-red border border-red/40 hover:border-red transition-all duration-200 cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
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
          className="text-gold-dim hover:text-gold transition-colors duration-200 text-base font-heading interactive-btn"
        >
          Creation Station
        </Link>
        <Link
          href="/gallery"
          className="text-gold-dim hover:text-gold transition-colors duration-200 text-base font-heading interactive-btn"
        >
          Gallery
        </Link>
      </div>

      <Link
        href="/"
        className="mt-6 text-gold-dim hover:text-gold transition-colors duration-200 text-lg min-h-[44px] flex items-center interactive-btn font-heading"
      >
        &larr; Back to Menu
      </Link>

      {/* Rasta stripe decoration - bottom */}
      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-green origin-bottom" />
        <div className="rasta-segment flex-1 bg-gold origin-bottom" />
        <div className="rasta-segment flex-1 bg-red origin-bottom" />
      </div>
    </div>
  );
}
