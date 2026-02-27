"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SocketClient } from "@/multiplayer/SocketClient";

type PageStatus = "connecting" | "ready" | "saving" | "saved" | "error";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DURATION_S = 180; // 3 minutes

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MusicUploadPage() {
  const router = useRouter();
  const socketRef = useRef<SocketClient | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const [status, setStatus] = useState<PageStatus>("connecting");
  const [title, setTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // ---------- Socket connection ----------

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

  // ---------- Cleanup audio on unmount ----------

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // ---------- File validation ----------

  const validateAndSetFile = useCallback((selected: File) => {
    // Check extension
    if (!selected.name.toLowerCase().endsWith(".mp3")) {
      setErrorMessage("Only .mp3 files are accepted.");
      setStatus("error");
      return;
    }

    // Check MIME type
    if (selected.type && !selected.type.includes("audio/mpeg")) {
      setErrorMessage("Only .mp3 files are accepted.");
      setStatus("error");
      return;
    }

    // Check file size
    if (selected.size > MAX_FILE_SIZE) {
      setErrorMessage(
        `File is too large (${(selected.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`
      );
      setStatus("error");
      return;
    }

    // Check duration by loading into an audio element
    const url = URL.createObjectURL(selected);
    const audio = new Audio(url);

    audio.addEventListener("loadedmetadata", () => {
      const dur = audio.duration;
      if (dur > MAX_DURATION_S) {
        setErrorMessage(
          `Track is too long (${formatTime(dur)}). Maximum is 3 minutes.`
        );
        setStatus("error");
        URL.revokeObjectURL(url);
        return;
      }

      // Valid file - set up
      setDurationMs(Math.round(dur * 1000));
      setDuration(dur);
      setCurrentTime(0);
      setIsPlaying(false);
      setFile(selected);
      setErrorMessage("");
      setStatus("ready");

      // Keep this audio element for playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = audio;

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      });
    });

    audio.addEventListener("error", () => {
      setErrorMessage("Could not read audio file. Please use a valid .mp3.");
      setStatus("error");
      URL.revokeObjectURL(url);
    });
  }, []);

  // ---------- Drag and drop handlers ----------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) {
        validateAndSetFile(dropped);
      }
    },
    [validateAndSetFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        validateAndSetFile(selected);
      }
    },
    [validateAndSetFile]
  );

  // ---------- Playback controls ----------

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    } else {
      audio.play();
      setIsPlaying(true);
      progressIntervalRef.current = setInterval(() => {
        setCurrentTime(audio.currentTime);
      }, 100);
    }
  }, [isPlaying]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      if (!audio) return;
      const time = parseFloat(e.target.value);
      audio.currentTime = time;
      setCurrentTime(time);
    },
    []
  );

  // ---------- Remove file ----------

  const removeFile = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setFile(null);
    setDurationMs(0);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // ---------- Save / upload ----------

  const handleSave = useCallback(async () => {
    const client = socketRef.current;
    if (!client || !file) return;

    const trackTitle = title.trim();
    if (!trackTitle) {
      setErrorMessage("Please give your track a title.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMessage("");

    try {
      const result = await client.createAsset({
        type: "music",
        title: trackTitle,
        metadata: JSON.stringify({
          duration_ms: durationMs,
          file_size: file.size,
        }),
        needsUpload: true,
        contentType: "audio/mpeg",
        fileSize: file.size,
      });

      // Upload to presigned URL
      if (result.uploadUrl) {
        const uploadRes = await fetch(result.uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": "audio/mpeg",
          },
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload file");
        }
      }

      setStatus("saved");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save track"
      );
      setStatus("error");
    }
  }, [title, file, durationMs]);

  // ---------- Render ----------

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
        Upload Music
      </h1>
      <p className="text-[#D4A857] text-sm mb-8 font-heading">
        Add your own riddims to the board
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
              Track uploaded! Bless up.
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
              htmlFor="music-title"
              className="text-[#D4A857] text-xs font-heading tracking-wider uppercase mb-2 block"
            >
              Track Title
            </label>
            <input
              id="music-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Island Vibes, Reggae Sunrise..."
              maxLength={60}
              className="w-full rounded-xl bg-[#1A1A0E] border border-[#8B4513] px-4 py-2.5 text-[#FFD700] font-heading text-base placeholder:text-[#D4A857]/30 focus:outline-none focus:border-[#FFD700] transition-colors"
            />
          </div>

          {/* File drop zone */}
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors duration-200 ${
                dragOver
                  ? "border-[#FFD700] bg-[#FFD700]/10"
                  : "border-[#8B4513] bg-[#1A1A0E] hover:border-[#D4A857]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,audio/mpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="text-4xl mb-3">
                <span className="text-[#D4A857]" aria-hidden="true">
                  &#9835;
                </span>
              </div>
              <p className="text-[#F4E1C1] font-heading text-base mb-2">
                Drag and drop an .mp3 file here
              </p>
              <p className="text-[#D4A857]/60 font-heading text-xs">
                or click to browse &middot; Max 3 minutes &middot; Max 10 MB
              </p>
            </div>
          ) : (
            /* File preview / player */
            <div className="rounded-2xl border-2 border-[#8B4513] bg-[#1A1A0E] p-6">
              {/* File info */}
              <div className="flex items-center justify-between mb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[#F4E1C1] font-heading text-sm truncate">
                    {file.name}
                  </p>
                  <p className="text-[#D4A857]/60 font-heading text-xs mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB &middot;{" "}
                    {formatTime(duration)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="ml-3 text-[#CE1126] hover:text-[#CE1126]/80 transition-colors text-xs font-heading cursor-pointer"
                >
                  Remove
                </button>
              </div>

              {/* Play/Pause + Progress bar */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FFD700] hover:bg-[#D4A857] transition-colors flex items-center justify-center cursor-pointer"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="#1A1A0E"
                    >
                      <rect x="3" y="2" width="4" height="12" rx="1" />
                      <rect x="9" y="2" width="4" height="12" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="#1A1A0E"
                    >
                      <polygon points="4,2 14,8 4,14" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[#D4A857]/60 text-xs font-heading w-10 text-right">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-[#8B4513] cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FFD700] [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#FFD700] [&::-moz-range-thumb]:border-0"
                  />
                  <span className="text-[#D4A857]/60 text-xs font-heading w-10">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleSave}
              disabled={!file || !title.trim() || status === "saving"}
              className="rounded-2xl wood-btn wood-btn-bamboo px-10 py-3 text-lg font-bold text-[#1A1A0E] shadow-lg interactive-btn cursor-pointer font-heading disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "saving" ? "Uploading..." : "Upload Track"}
            </button>
          </div>

          {/* Saving indicator */}
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
