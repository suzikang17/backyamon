"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SocketClient } from "@/multiplayer/SocketClient";

interface WaitingRoom {
  id: string;
  hostName: string;
  createdAt: string;
}

type LobbyView = "lobby" | "quick-match" | "waiting";

export default function LobbyPage() {
  const router = useRouter();
  const socketRef = useRef<SocketClient | null>(null);
  const [view, setView] = useState<LobbyView>("lobby");
  const [connected, setConnected] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [claimingUsername, setClaimingUsername] = useState(false);
  const [rooms, setRooms] = useState<WaitingRoom[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [customRoomName, setCustomRoomName] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(true);

  // Connect, register, and listen for room updates
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
        setUsername(identity.username);
        setConnecting(false);

        client.listRooms();
      } catch (err) {
        if (destroyed) return;
        setError(
          err instanceof Error ? err.message : "Failed to connect to server"
        );
        setConnecting(false);
      }
    };

    client.on("disconnect", () => {
      if (!destroyed) setConnected(false);
    });

    client.on("connect", () => {
      if (!destroyed) {
        setConnected(true);
        client.listRooms();
      }
    });

    client.on("room-list", (data: unknown) => {
      if (!destroyed) {
        const { rooms: roomList } = data as { rooms: WaitingRoom[] };
        setRooms(roomList);
      }
    });

    setup();

    return () => {
      destroyed = true;
      client.destroy();
      socketRef.current = null;
    };
  }, []);

  const handleQuickMatch = useCallback(async () => {
    const client = socketRef.current;
    if (!client) return;

    setView("quick-match");
    setError("");

    const onMatchFound = (data: unknown) => {
      const { roomId } = data as { roomId: string };
      router.push(`/play?mode=online&roomId=${roomId}`);
    };

    const onError = (data: unknown) => {
      const { message } = data as { message: string };
      setError(message);
      setView("lobby");
      client.off("match-found", onMatchFound);
      client.off("error", onError);
    };

    client.on("match-found", onMatchFound);
    client.on("error", onError);

    try {
      await client.quickMatch();
    } catch {
      setError("Failed to join matchmaking queue");
      setView("lobby");
    }
  }, [router]);

  const handleCreateRoom = useCallback(async () => {
    const client = socketRef.current;
    if (!client) return;

    setError("");

    try {
      const name = customRoomName.trim() || undefined;
      const code = await client.createRoom(name);
      setRoomCode(code);
      setCustomRoomName("");
      setView("waiting");

      const onRoomJoined = () => {
        router.push(`/play?mode=online&roomId=${code}`);
      };

      client.on("room-joined", onRoomJoined);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create room"
      );
    }
  }, [router, customRoomName]);

  const handleJoinRoom = useCallback(async (roomId: string) => {
    const client = socketRef.current;
    if (!client) return;

    setError("");

    try {
      await client.joinRoom(roomId);
      router.push(`/play?mode=online&roomId=${roomId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to join room"
      );
    }
  }, [router]);

  const handleCancelSearch = useCallback(() => {
    const client = socketRef.current;
    if (client) client.leaveQueue();
    setView("lobby");
  }, []);

  const handleCancelRoom = useCallback(() => {
    setView("lobby");
    setRoomCode("");
  }, []);

  const handleClaimUsername = useCallback(async () => {
    const client = socketRef.current;
    if (!client || !usernameInput.trim()) return;

    setUsernameError("");
    setClaimingUsername(true);

    try {
      const claimed = await client.claimUsername(usernameInput.trim());
      setDisplayName(claimed);
      setUsername(claimed);
      setUsernameInput("");
    } catch (err) {
      setUsernameError(
        err instanceof Error ? err.message : "Failed to claim username"
      );
    } finally {
      setClaimingUsername(false);
    }
  }, [usernameInput]);

  return (
    <div className="animated-bg flex min-h-screen flex-col items-center justify-center px-4">
      {/* Rasta stripe decoration */}
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-[#006B3F]" />
        <div className="rasta-segment flex-1 bg-[#FFD700]" />
        <div className="rasta-segment flex-1 bg-[#CE1126]" />
      </div>

      {/* Title */}
      <h1 className="title-glow font-display text-5xl sm:text-6xl text-[#FFD700] mb-2 tracking-wide">
        Online Lobby
      </h1>

      {/* Connection + identity */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            connected ? "bg-[#006B3F]" : "bg-[#CE1126]"
          }`}
        />
        <span className="text-[#D4A857] text-sm font-heading">
          {connecting ? "Connecting..." : connected ? "Connected" : "Disconnected"}
        </span>
        {displayName && (
          <span className="text-[#F4E1C1] text-sm ml-1">
            as <span className="text-[#FFD700] font-bold">{displayName}</span>
          </span>
        )}
      </div>

      {/* Username claim — compact inline */}
      {!connecting && connected && !username && (
        <div className="flex items-center gap-2 mb-6">
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleClaimUsername(); }}
            placeholder="Claim a username"
            maxLength={20}
            className="rounded-xl bg-[#1A1A0E] border border-[#8B4513] px-3 py-1.5 text-[#FFD700] font-heading text-sm text-center placeholder:text-[#D4A857]/40 focus:outline-none focus:border-[#FFD700] w-40"
          />
          <button
            onClick={handleClaimUsername}
            disabled={claimingUsername || !usernameInput.trim()}
            className="rounded-xl wood-btn wood-btn-green px-4 py-1.5 text-sm font-bold text-[#FFD700] interactive-btn cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-heading"
          >
            {claimingUsername ? "..." : "Claim"}
          </button>
          {usernameError && (
            <span className="text-[#CE1126] text-xs">{usernameError}</span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[#CE1126]/20 border border-[#CE1126] rounded-xl px-6 py-2 mb-4 max-w-md text-center">
          <p className="text-[#CE1126] text-sm">{error}</p>
        </div>
      )}

      {/* Main content */}
      <div className="w-full max-w-md">
        {view === "lobby" && (
          <div className="flex flex-col gap-4">
            {/* Action buttons — same style as main menu */}
            <button
              onClick={handleQuickMatch}
              disabled={!connected || connecting}
              className="w-full rounded-2xl wood-btn wood-btn-green px-8 py-4 text-xl font-bold text-[#FFD700] shadow-lg interactive-btn cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-heading hover:shadow-[0_0_20px_rgba(0,107,63,0.4)]"
            >
              Quick Match
            </button>

            <button
              onClick={handleCreateRoom}
              disabled={!connected || connecting}
              className="w-full rounded-2xl wood-btn wood-btn-bamboo px-8 py-4 text-xl font-bold text-[#1A1A0E] shadow-lg interactive-btn cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-heading hover:shadow-[0_0_20px_rgba(212,168,87,0.4)]"
            >
              Create Room
            </button>

            {/* Optional custom name — subtle, below create */}
            <input
              type="text"
              value={customRoomName}
              onChange={(e) => setCustomRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && connected && !connecting) handleCreateRoom();
              }}
              placeholder="custom room name (optional)"
              maxLength={30}
              className="w-full rounded-xl bg-[#1A1A0E]/60 border border-[#8B4513]/50 px-4 py-2 text-[#FFD700] font-heading text-sm text-center placeholder:text-[#D4A857]/30 focus:outline-none focus:border-[#D4A857] -mt-2"
            />

            {/* Rasta divider */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 h-px bg-[#006B3F]/40" />
              <div className="flex-1 h-px bg-[#FFD700]/40" />
              <div className="flex-1 h-px bg-[#CE1126]/40" />
            </div>

            {/* Open rooms list */}
            <div className="flex flex-col gap-2">
              <p className="text-[#D4A857] text-xs font-heading text-center tracking-wider uppercase">
                Open Rooms
              </p>

              {rooms.length === 0 ? (
                <p className="text-[#D4A857]/40 text-sm text-center py-6 font-heading">
                  No rooms yet — small up yuhself and create one!
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => handleJoinRoom(room.id)}
                      disabled={!connected}
                      className="
                        flex items-center justify-between
                        rounded-xl bg-[#1A1A0E]/80 border border-[#8B4513]/60
                        px-5 py-3
                        transition-all duration-200
                        hover:border-[#FFD700] hover:shadow-[0_0_12px_rgba(255,215,0,0.15)]
                        active:scale-[0.98]
                        cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                        group
                      "
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[#FFD700] font-heading text-base">
                          {room.id}
                        </span>
                        <span className="text-[#D4A857]/60 text-xs">
                          {room.hostName}
                        </span>
                      </div>
                      <span className="text-[#006B3F] font-heading text-sm group-hover:text-[#FFD700] transition-colors">
                        Join &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === "quick-match" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#006B3F] animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-3 h-3 rounded-full bg-[#FFD700] animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-3 h-3 rounded-full bg-[#CE1126] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>

            <p className="text-[#FFD700] font-heading text-2xl">
              Mi soon come... searching!
            </p>

            <button
              onClick={handleCancelSearch}
              className="rounded-2xl bg-[#3a3a2e] px-8 py-3 text-lg font-bold text-[#D4A857] shadow-lg interactive-btn cursor-pointer font-heading"
            >
              Cancel
            </button>
          </div>
        )}

        {view === "waiting" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <p className="text-[#D4A857] text-sm font-heading">
              Your room is open
            </p>

            <div className="bg-[#1A1A0E] border-2 border-[#FFD700] rounded-2xl px-8 py-4 shadow-[0_0_20px_rgba(255,215,0,0.15)]">
              <p className="text-[#FFD700] font-heading text-2xl sm:text-3xl tracking-wide select-all text-center">
                {roomCode || "..."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-[#FFD700] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#FFD700] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#FFD700] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-[#D4A857]/60 text-sm">
                Mi deh yah, yuh know...
              </p>
            </div>

            <button
              onClick={handleCancelRoom}
              className="rounded-2xl bg-[#3a3a2e] px-8 py-3 text-lg font-bold text-[#D4A857] shadow-lg interactive-btn cursor-pointer font-heading"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <Link
        href="/"
        className="mt-8 text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-lg font-heading"
      >
        &larr; Back to Menu
      </Link>

      {/* Bottom rasta stripe */}
      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-[#006B3F]" />
        <div className="rasta-segment flex-1 bg-[#FFD700]" />
        <div className="rasta-segment flex-1 bg-[#CE1126]" />
      </div>
    </div>
  );
}
