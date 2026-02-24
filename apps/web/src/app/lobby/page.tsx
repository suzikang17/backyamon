"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SocketClient } from "@/multiplayer/SocketClient";

type LobbyView =
  | "menu"
  | "quick-match"
  | "create-room"
  | "join-room";

export default function LobbyPage() {
  const router = useRouter();
  const socketRef = useRef<SocketClient | null>(null);
  const [view, setView] = useState<LobbyView>("menu");
  const [connected, setConnected] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(true);

  // Connect and register on mount
  useEffect(() => {
    const client = new SocketClient();
    socketRef.current = client;

    let destroyed = false;

    const setup = async () => {
      try {
        await client.connect();
        if (destroyed) return;
        setConnected(true);

        const identity = await client.register();
        if (destroyed) return;
        setDisplayName(identity.displayName);
        setConnecting(false);
      } catch (err) {
        if (destroyed) return;
        setError(
          err instanceof Error ? err.message : "Failed to connect to server"
        );
        setConnecting(false);
      }
    };

    // Listen for disconnect/reconnect
    client.on("disconnect", () => {
      if (!destroyed) setConnected(false);
    });

    client.on("connect", () => {
      if (!destroyed) setConnected(true);
    });

    setup();

    return () => {
      destroyed = true;
      client.destroy();
      socketRef.current = null;
    };
  }, []);

  // Handle Quick Match
  const handleQuickMatch = useCallback(async () => {
    const client = socketRef.current;
    if (!client) return;

    setView("quick-match");
    setError("");

    // Listen for match-found then redirect to the game
    const onMatchFound = (data: unknown) => {
      const { roomId } = data as { roomId: string };
      router.push(`/play?mode=online&roomId=${roomId}`);
    };

    const onError = (data: unknown) => {
      const { message } = data as { message: string };
      setError(message);
      setView("menu");
      client.off("match-found", onMatchFound);
      client.off("error", onError);
    };

    client.on("match-found", onMatchFound);
    client.on("error", onError);

    try {
      await client.quickMatch();
    } catch {
      setError("Failed to join matchmaking queue");
      setView("menu");
    }
  }, [router]);

  // Handle Create Room
  const handleCreateRoom = useCallback(async () => {
    const client = socketRef.current;
    if (!client) return;

    setView("create-room");
    setError("");

    try {
      const code = await client.createRoom();
      setRoomCode(code);

      // Wait for opponent to join; room-joined means game starts
      const onRoomJoined = () => {
        router.push(`/play?mode=online&roomId=${code}`);
      };

      client.on("room-joined", onRoomJoined);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create room"
      );
      setView("menu");
    }
  }, [router]);

  // Handle Join Room
  const handleJoinRoom = useCallback(async () => {
    const client = socketRef.current;
    if (!client) return;

    if (!joinCode.trim()) {
      setError("Please enter a room code");
      return;
    }

    setError("");

    try {
      await client.joinRoom(joinCode.trim());
      router.push(`/play?mode=online&roomId=${joinCode.trim().toUpperCase()}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to join room"
      );
    }
  }, [joinCode, router]);

  // Cancel quick match
  const handleCancelSearch = useCallback(() => {
    const client = socketRef.current;
    if (client) client.leaveQueue();
    setView("menu");
  }, []);

  // Cancel create room
  const handleCancelRoom = useCallback(() => {
    setView("menu");
    setRoomCode("");
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Rasta stripe decoration */}
      <div className="fixed top-0 left-0 right-0 flex h-2 z-50">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>

      <h1 className="font-heading text-5xl sm:text-6xl text-[#FFD700] mb-4 tracking-wide">
        Online Lobby
      </h1>

      {/* Connection status */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className={`w-3 h-3 rounded-full ${
            connected ? "bg-[#006B3F]" : "bg-[#CE1126]"
          }`}
        />
        <span className="text-[#D4A857] text-sm">
          {connecting
            ? "Connecting..."
            : connected
            ? "Connected"
            : "Disconnected"}
        </span>
        {displayName && (
          <span className="text-[#F4E1C1] text-sm ml-2">
            Playing as{" "}
            <span className="text-[#FFD700] font-bold">{displayName}</span>
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-[#CE1126]/20 border border-[#CE1126] rounded-xl px-6 py-3 mb-6 max-w-md text-center">
          <p className="text-[#CE1126] text-sm">{error}</p>
        </div>
      )}

      {/* Main lobby content */}
      <div className="rounded-2xl bg-[#2a2a1e] border-2 border-[#8B4513] px-8 sm:px-12 py-10 shadow-lg w-full max-w-md">
        {view === "menu" && (
          <div className="flex flex-col gap-4">
            <button
              onClick={handleQuickMatch}
              disabled={!connected || connecting}
              className="rounded-xl bg-[#006B3F] px-6 py-4 text-xl font-bold text-[#FFD700] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-heading"
            >
              Quick Match
            </button>

            <button
              onClick={handleCreateRoom}
              disabled={!connected || connecting}
              className="rounded-xl bg-[#D4A857] px-6 py-4 text-xl font-bold text-[#1A1A0E] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-heading"
            >
              Create Private Room
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-[#8B4513]/50" />
              <span className="text-[#D4A857] text-sm">or join a room</span>
              <div className="flex-1 h-px bg-[#8B4513]/50" />
            </div>

            {/* Join room section */}
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoinRoom();
                }}
                placeholder="Room Code"
                maxLength={6}
                className="flex-1 rounded-xl bg-[#1A1A0E] border-2 border-[#8B4513] px-4 py-3 text-[#FFD700] font-heading text-lg text-center tracking-[0.3em] placeholder:text-[#D4A857]/40 placeholder:tracking-normal focus:outline-none focus:border-[#FFD700]"
              />
              <button
                onClick={handleJoinRoom}
                disabled={!connected || connecting || !joinCode.trim()}
                className="rounded-xl bg-[#006B3F] px-6 py-3 text-lg font-bold text-[#FFD700] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-heading"
              >
                Join
              </button>
            </div>
          </div>
        )}

        {view === "quick-match" && (
          <div className="flex flex-col items-center gap-6">
            {/* Searching animation */}
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#006B3F] animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-3 h-3 rounded-full bg-[#FFD700] animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-3 h-3 rounded-full bg-[#CE1126] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>

            <p className="text-[#FFD700] font-heading text-2xl">
              Searching for opponent...
            </p>
            <p className="text-[#D4A857] text-sm">
              Waiting for another player to join
            </p>

            <button
              onClick={handleCancelSearch}
              className="rounded-xl bg-[#8B4513] px-6 py-3 text-lg font-bold text-[#F4E1C1] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 cursor-pointer font-heading mt-2"
            >
              Cancel
            </button>
          </div>
        )}

        {view === "create-room" && (
          <div className="flex flex-col items-center gap-6">
            <p className="text-[#D4A857] text-sm">Share this code with your friend:</p>

            {/* Room code display */}
            <div className="bg-[#1A1A0E] border-2 border-[#FFD700] rounded-2xl px-8 py-4">
              <p className="text-[#FFD700] font-heading text-4xl tracking-[0.4em] select-all">
                {roomCode || "------"}
              </p>
            </div>

            {/* Waiting animation */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-[#FFD700] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#FFD700] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#FFD700] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-[#D4A857] text-sm">
                Waiting for opponent to join...
              </p>
            </div>

            <button
              onClick={handleCancelRoom}
              className="rounded-xl bg-[#8B4513] px-6 py-3 text-lg font-bold text-[#F4E1C1] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 cursor-pointer font-heading mt-2"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <Link
        href="/"
        className="mt-10 text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-lg"
      >
        &larr; Back to Menu
      </Link>

      {/* Bottom rasta stripe decoration */}
      <div className="fixed bottom-0 left-0 right-0 flex h-2 z-50">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>
    </main>
  );
}
