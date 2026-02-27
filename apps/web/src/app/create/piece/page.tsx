"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SocketClient } from "@/multiplayer/SocketClient";
import { PieceDesigner } from "@/components/PieceDesigner";

type PageStatus = "connecting" | "ready" | "saving" | "saved" | "error";

export default function PieceDesignerPage() {
  const router = useRouter();
  const socketRef = useRef<SocketClient | null>(null);
  const [status, setStatus] = useState<PageStatus>("connecting");
  const [title, setTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const client = new SocketClient();
    socketRef.current = client;

    async function connect(): Promise<void> {
      try {
        await client.connect({ maxRetries: 5 });
        await client.register();
        setStatus("ready");
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to connect to server"
        );
        setStatus("error");
      }
    }

    connect();

    return () => {
      client.destroy();
      socketRef.current = null;
    };
  }, []);

  const handleSave = useCallback(
    async (goldSvg: string, redSvg: string) => {
      const client = socketRef.current;
      if (!client) return;

      const pieceName = title.trim();
      if (!pieceName) {
        setErrorMessage("Please give your piece a name.");
        setStatus("error");
        return;
      }

      setStatus("saving");
      setErrorMessage("");

      try {
        await client.createAsset({
          type: "piece",
          title: pieceName,
          metadata: JSON.stringify({
            svg_gold: goldSvg,
            svg_red: redSvg,
          }),
          needsUpload: false,
        });
        setStatus("saved");
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to save piece"
        );
        setStatus("error");
      }
    },
    [title]
  );

  return (
    <div className="animated-bg flex min-h-screen flex-col items-center px-4 py-16">
      {/* Rasta stripe decoration - top */}
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-[#006B3F]" />
        <div className="rasta-segment flex-1 bg-[#FFD700]" />
        <div className="rasta-segment flex-1 bg-[#CE1126]" />
      </div>

      {/* Title */}
      <h1 className="title-glow font-spice text-3xl sm:text-5xl text-[#FFD700] mb-2 tracking-wide">
        Design a Piece
      </h1>
      <p className="text-[#D4A857] text-sm mb-8 font-heading">
        Draw your custom checker for gold and red sides
      </p>

      {/* Connection status */}
      {status === "connecting" && (
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFD700] animate-pulse" />
          <span className="text-[#D4A857] text-sm font-heading">
            Connecting to server...
          </span>
        </div>
      )}

      {/* Error message */}
      {status === "error" && errorMessage && (
        <div className="bg-[#CE1126]/20 border border-[#CE1126] rounded-xl px-6 py-3 mb-6 max-w-md text-center">
          <p className="text-[#CE1126] text-sm font-heading">{errorMessage}</p>
        </div>
      )}

      {/* Success message */}
      {status === "saved" && (
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="bg-[#006B3F]/20 border border-[#006B3F] rounded-xl px-6 py-3 max-w-md text-center">
            <p className="text-[#006B3F] text-sm font-heading">
              Piece saved! Bless up.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/create")}
            className="rounded-2xl wood-btn wood-btn-bamboo px-8 py-3 text-lg font-bold text-[#1A1A0E] shadow-lg interactive-btn cursor-pointer font-heading"
          >
            Back to Creation Station
          </button>
        </div>
      )}

      {/* Main content */}
      {(status === "ready" || status === "error" || status === "saving") && (
        <div className="w-full max-w-4xl">
          {/* Title input */}
          <div className="mb-6">
            <label
              htmlFor="piece-title"
              className="text-[#D4A857] text-xs font-heading tracking-wider uppercase mb-2 block"
            >
              Piece Name
            </label>
            <input
              id="piece-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Rasta Lion, Island Sun..."
              maxLength={40}
              className="w-full max-w-sm rounded-xl bg-[#1A1A0E] border border-[#8B4513] px-4 py-2.5 text-[#FFD700] font-heading text-base placeholder:text-[#D4A857]/30 focus:outline-none focus:border-[#FFD700] transition-colors"
            />
          </div>

          {/* Designer */}
          <PieceDesigner onSave={handleSave} />

          {/* Saving overlay */}
          {status === "saving" && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFD700] animate-pulse" />
              <span className="text-[#D4A857] text-sm font-heading">
                Saving...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Back link */}
      <Link
        href="/create"
        className="mt-10 text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-lg font-heading interactive-btn"
      >
        &larr; Back to Creation Station
      </Link>

      {/* Rasta stripe decoration - bottom */}
      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-[#006B3F]" />
        <div className="rasta-segment flex-1 bg-[#FFD700]" />
        <div className="rasta-segment flex-1 bg-[#CE1126]" />
      </div>
    </div>
  );
}
