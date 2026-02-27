"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SocketClient } from "@/multiplayer/SocketClient";

type PageStatus = "connecting" | "ready" | "saving" | "saved" | "error";

const SFX_SLOTS = [
  { value: "dice-roll", label: "Dice Roll" },
  { value: "piece-move", label: "Piece Move" },
  { value: "piece-hit", label: "Piece Hit" },
  { value: "bear-off", label: "Bear Off" },
  { value: "victory", label: "Victory" },
  { value: "defeat", label: "Defeat" },
  { value: "double-offered", label: "Double Offered" },
  { value: "turn-start", label: "Turn Start" },
] as const;

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_DURATION = 5; // seconds

export default function SoundUploadPage() {
  const router = useRouter();
  const socketRef = useRef<SocketClient | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState<PageStatus>("connecting");
  const [title, setTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [sfxSlot, setSfxSlot] = useState<string>(SFX_SLOTS[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // ── Socket connection ─────────────────────────────────────────────────
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

  // ── Clean up object URL on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  // ── Validate and set audio file ───────────────────────────────────────
  const processFile = useCallback((selectedFile: File) => {
    setFileError("");
    setFile(null);
    setDuration(null);
    setIsPlaying(false);

    // Revoke previous object URL
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    // Check file type
    const validTypes = ["audio/mpeg", "audio/wav", "audio/x-wav"];
    if (!validTypes.includes(selectedFile.type)) {
      setFileError("Only .mp3 and .wav files are accepted.");
      return;
    }

    // Check file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFileError(
        `File is too large (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB). Maximum is 2 MB.`
      );
      return;
    }

    // Check duration using Audio element
    const url = URL.createObjectURL(selectedFile);
    const audio = new Audio();

    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration > MAX_DURATION) {
        setFileError(
          `Audio is too long (${audio.duration.toFixed(1)}s). Maximum is ${MAX_DURATION} seconds.`
        );
        URL.revokeObjectURL(url);
        return;
      }

      setFile(selectedFile);
      setDuration(audio.duration);
      setObjectUrl(url);
    });

    audio.addEventListener("error", () => {
      setFileError("Could not read audio file. Please try a different file.");
      URL.revokeObjectURL(url);
    });

    audio.src = url;
  }, []);

  // ── Drag and drop handlers ────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        processFile(droppedFile);
      }
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        processFile(selectedFile);
      }
    },
    [processFile]
  );

  // ── Preview playback ─────────────────────────────────────────────────
  const handlePreview = useCallback(() => {
    if (!objectUrl) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(objectUrl);
    audioRef.current = audio;

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
    });

    audio.play();
    setIsPlaying(true);
  }, [objectUrl, isPlaying]);

  // ── Save handler ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const client = socketRef.current;
    if (!client || !file) return;

    const soundTitle = title.trim();
    if (!soundTitle) {
      setErrorMessage("Please give your sound effect a name.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMessage("");

    try {
      const result = await client.createAsset({
        type: "sfx",
        title: soundTitle,
        metadata: JSON.stringify({
          slot: sfxSlot,
          duration_ms: Math.round((duration ?? 0) * 1000),
          file_size: file.size,
        }),
        needsUpload: true,
        contentType: file.type,
        fileSize: file.size,
      });

      if (result.uploadUrl) {
        const uploadResponse = await fetch(result.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload audio file");
        }
      }

      setStatus("saved");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save sound effect"
      );
      setStatus("error");
    }
  }, [title, file, sfxSlot]);

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
        Upload Sound Effect
      </h1>
      <p className="text-[#D4A857] text-sm mb-8 font-heading">
        Add your own sounds to the game
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
              Sound effect saved! Bless up.
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
        <div className="w-full max-w-lg">
          {/* Title input */}
          <div className="mb-6">
            <label
              htmlFor="sound-title"
              className="text-[#D4A857] text-xs font-heading tracking-wider uppercase mb-2 block"
            >
              Sound Name
            </label>
            <input
              id="sound-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Island Drum, Steel Pan Hit..."
              maxLength={40}
              className="w-full rounded-xl bg-[#1A1A0E] border border-[#8B4513] px-4 py-2.5 text-[#FFD700] font-heading text-base placeholder:text-[#D4A857]/30 focus:outline-none focus:border-[#FFD700] transition-colors"
            />
          </div>

          {/* SFX Slot dropdown */}
          <div className="mb-6">
            <label
              htmlFor="sfx-slot"
              className="text-[#D4A857] text-xs font-heading tracking-wider uppercase mb-2 block"
            >
              Sound Slot
            </label>
            <select
              id="sfx-slot"
              value={sfxSlot}
              onChange={(e) => setSfxSlot(e.target.value)}
              className="w-full rounded-xl bg-[#1A1A0E] border border-[#8B4513] px-4 py-2.5 text-[#FFD700] font-heading text-base focus:outline-none focus:border-[#FFD700] transition-colors cursor-pointer"
            >
              {SFX_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>

          {/* Drag and drop zone */}
          <div className="mb-6">
            <label className="text-[#D4A857] text-xs font-heading tracking-wider uppercase mb-2 block">
              Audio File
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors duration-200 ${
                isDragging
                  ? "border-[#FFD700] bg-[#FFD700]/10"
                  : "border-[#8B4513] bg-[#1A1A0E] hover:border-[#D4A857]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[#FFD700] text-2xl">&#9835;</div>
                  <p className="text-[#F4E1C1] text-sm font-heading">
                    {file.name}
                  </p>
                  <p className="text-[#D4A857] text-xs font-heading">
                    {(file.size / 1024).toFixed(0)} KB &middot;{" "}
                    {duration?.toFixed(1)}s
                  </p>
                  <p className="text-[#D4A857]/50 text-xs font-heading mt-1">
                    Click or drop to replace
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[#D4A857] text-3xl">&#9835;</div>
                  <p className="text-[#F4E1C1] text-sm font-heading">
                    Drop an audio file here or click to browse
                  </p>
                  <p className="text-[#D4A857]/50 text-xs font-heading">
                    .mp3 or .wav &middot; Max 2 MB &middot; Max 5 seconds
                  </p>
                </div>
              )}
            </div>

            {/* File validation error */}
            {fileError && (
              <p className="text-[#CE1126] text-xs font-heading mt-2">
                {fileError}
              </p>
            )}
          </div>

          {/* Preview button */}
          {file && objectUrl && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handlePreview}
                className="rounded-xl bg-[#2a2a1e] border border-[#8B4513] px-6 py-2.5 text-[#FFD700] font-heading text-sm hover:border-[#FFD700] transition-colors cursor-pointer interactive-btn"
              >
                {isPlaying ? "Stop Preview" : "Preview Sound"}
              </button>
            </div>
          )}

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!file || !title.trim() || status === "saving"}
            className="w-full rounded-2xl wood-btn wood-btn-bamboo px-8 py-3 text-lg font-bold text-[#1A1A0E] shadow-lg interactive-btn cursor-pointer font-heading disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "saving" ? "Saving..." : "Save Sound Effect"}
          </button>

          {/* Saving overlay */}
          {status === "saving" && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFD700] animate-pulse" />
              <span className="text-[#D4A857] text-sm font-heading">
                Uploading...
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
