"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Player, type GameState, type WinType } from "@backyamon/engine";
import { GameCanvas } from "@/components/GameCanvas";
import { OnlineGameCanvas } from "@/components/OnlineGameCanvas";
import { SocketClient } from "@/multiplayer/SocketClient";

const aiNames: Record<string, string> = {
  easy: "Beach Bum",
  medium: "Selector",
  hard: "King Tubby",
};

const difficultyColors: Record<string, string> = {
  easy: "#006B3F",
  medium: "#FFD700",
  hard: "#CE1126",
};

const winTypeLabels: Record<WinType, string> = {
  ya_mon: "Ya Mon!",
  big_ya_mon: "Big Ya Mon! (Gammon)",
  massive_ya_mon: "Massive Ya Mon! (Backgammon)",
};

// ── AI (single-player) game view ──────────────────────────────────────

function AIPlayContent({
  difficulty,
}: {
  difficulty: string;
}) {
  const router = useRouter();
  const aiName = aiNames[difficulty] ?? "Beach Bum";
  const accentColor = difficultyColors[difficulty] ?? "#FFD700";

  const [gameOver, setGameOver] = useState<{
    winner: Player;
    winType: WinType;
  } | null>(null);

  const [gameKey, setGameKey] = useState(0);

  const handleGameOver = useCallback((winner: Player, winType: WinType) => {
    setGameOver({ winner, winType });
  }, []);

  const handlePlayAgain = () => {
    setGameOver(null);
    setGameKey((k) => k + 1);
  };

  const handleBackToMenu = () => {
    router.push("/");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Rasta stripe decoration */}
      <div className="fixed top-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>

      <h1 className="font-heading text-4xl sm:text-5xl mb-4 tracking-wide">
        <span className="text-[#F4E1C1]">Playing vs </span>
        <span style={{ color: accentColor }}>{aiName}</span>
      </h1>

      {/* Game canvas */}
      <div className="relative">
        <GameCanvas
          key={gameKey}
          difficulty={difficulty}
          onGameOver={handleGameOver}
        />

        {/* Game Over overlay */}
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A0E]/85 rounded-2xl z-50">
            <div className="text-center px-8 py-6">
              <h2
                className="font-heading text-4xl sm:text-5xl mb-2 tracking-wide"
                style={{
                  color:
                    gameOver.winner === Player.Gold ? "#FFD700" : "#CE1126",
                }}
              >
                {gameOver.winner === Player.Gold
                  ? "You Win!"
                  : `${aiName} Wins!`}
              </h2>
              <p className="text-[#D4A857] text-xl mb-6 font-heading">
                {winTypeLabels[gameOver.winType]}
              </p>

              {/* Rasta divider */}
              <div className="flex w-48 mx-auto mb-6 rounded overflow-hidden">
                <div className="h-1 flex-1 bg-[#006B3F]" />
                <div className="h-1 flex-1 bg-[#FFD700]" />
                <div className="h-1 flex-1 bg-[#CE1126]" />
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handlePlayAgain}
                  className="rounded-xl bg-[#006B3F] px-6 py-3 text-lg font-bold text-[#FFD700] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  Play Again
                </button>
                <button
                  onClick={handleBackToMenu}
                  className="rounded-xl bg-[#D4A857] px-6 py-3 text-lg font-bold text-[#1A1A0E] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  Back to Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Link
        href="/"
        className="mt-8 text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-lg"
      >
        &larr; Back to Menu
      </Link>

      {/* Bottom rasta stripe decoration */}
      <div className="fixed bottom-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>
    </div>
  );
}

// ── Online (multiplayer) game view ────────────────────────────────────

function OnlinePlayContent({ roomId }: { roomId: string }) {
  const router = useRouter();
  const socketRef = useRef<SocketClient | null>(null);

  const [status, setStatus] = useState<
    "connecting" | "waiting" | "playing" | "error"
  >("connecting");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [opponentName, setOpponentName] = useState("Opponent");
  const [localPlayer, setLocalPlayer] = useState<Player>(Player.Gold);
  const [initialState, setInitialState] = useState<GameState | null>(null);

  const [gameOver, setGameOver] = useState<{
    winner: Player;
    winType: WinType;
    pointsWon: number;
  } | null>(null);

  const handleGameOver = useCallback(
    (winner: Player, winType: WinType, pointsWon: number) => {
      setGameOver({ winner, winType, pointsWon });
    },
    []
  );

  const handleBackToMenu = () => {
    router.push("/");
  };

  const handleBackToLobby = () => {
    router.push("/lobby");
  };

  useEffect(() => {
    const client = new SocketClient();
    socketRef.current = client;
    let destroyed = false;

    const setup = async () => {
      try {
        await client.connect();
        if (destroyed) return;
        setConnected(true);

        // Register (always re-register with a fresh socket)
        await client.register();
        if (destroyed) return;

        // Check if we have a saved identity for reconnection
        const identity = client.getIdentity();
        if (identity) {
          // Try to reconnect to the game
          client.reconnectToGame(identity.playerId, roomId);
        }

        setStatus("waiting");

        // Listen for room-joined (either from reconnect or fresh join)
        const onRoomJoined = (data: unknown) => {
          if (destroyed) return;
          const payload = data as {
            roomId: string;
            player: Player;
            state: GameState;
            opponent: { displayName: string } | null;
          };
          setLocalPlayer(payload.player);
          setInitialState(payload.state);
          if (payload.opponent) {
            setOpponentName(payload.opponent.displayName);
          }
          setStatus("playing");
        };

        const onGameStart = () => {
          // game-start fires after room-joined; room-joined has the data we need
        };

        const onError = (data: unknown) => {
          if (destroyed) return;
          const msg = (data as { message: string }).message;
          // If reconnect failed, show error
          if (status === "connecting" || status === "waiting") {
            setError(msg);
            setStatus("error");
          }
        };

        client.on("room-joined", onRoomJoined);
        client.on("game-start", onGameStart);
        client.on("error", onError);

        client.on("disconnect", () => {
          if (!destroyed) setConnected(false);
        });

        client.on("connect", () => {
          if (!destroyed) setConnected(true);
        });
      } catch (err) {
        if (destroyed) return;
        setError(
          err instanceof Error ? err.message : "Failed to connect to server"
        );
        setStatus("error");
      }
    };

    setup();

    return () => {
      destroyed = true;
      client.destroy();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Rasta stripe decoration */}
      <div className="fixed top-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>

      {/* Header */}
      {status === "playing" && (
        <div className="mb-4 text-center">
          <h1 className="font-heading text-4xl sm:text-5xl mb-1 tracking-wide">
            <span className="text-[#F4E1C1]">vs </span>
            <span className="text-[#CE1126]">{opponentName}</span>
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-[#006B3F]" : "bg-[#CE1126]"
              }`}
            />
            <span className="text-[#D4A857] text-xs">
              {connected ? "Connected" : "Reconnecting..."}
            </span>
            <span className="text-[#F4E1C1]/50 text-xs">|</span>
            <span className="text-[#D4A857] text-xs">
              You are{" "}
              <span
                className="font-bold"
                style={{
                  color:
                    localPlayer === Player.Gold ? "#FFD700" : "#CE1126",
                }}
              >
                {localPlayer === Player.Gold ? "Gold" : "Red"}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Loading / Waiting state */}
      {(status === "connecting" || status === "waiting") && (
        <div className="rounded-2xl bg-[#2a2a1e] border-2 border-[#8B4513] px-12 py-10 text-center shadow-lg">
          <div className="flex justify-center gap-2 mb-4">
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
          <p className="text-[#FFD700] font-heading text-2xl mb-2">
            {status === "connecting"
              ? "Connecting to server..."
              : "Joining game..."}
          </p>
          <p className="text-[#D4A857] text-sm">Room: {roomId}</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="rounded-2xl bg-[#2a2a1e] border-2 border-[#CE1126] px-12 py-10 text-center shadow-lg">
          <p className="text-[#CE1126] font-heading text-2xl mb-2">
            Connection Error
          </p>
          <p className="text-[#D4A857] text-sm mb-6">{error}</p>
          <button
            onClick={handleBackToLobby}
            className="rounded-xl bg-[#006B3F] px-6 py-3 text-lg font-bold text-[#FFD700] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 cursor-pointer"
          >
            Back to Lobby
          </button>
        </div>
      )}

      {/* Game canvas for online play */}
      {status === "playing" && initialState && socketRef.current && (
        <div className="relative">
          <OnlineGameCanvas
            socketClient={socketRef.current}
            roomId={roomId}
            localPlayer={localPlayer}
            initialState={initialState}
            opponentName={opponentName}
            onGameOver={handleGameOver}
          />

          {/* Game Over overlay */}
          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A0E]/85 rounded-2xl z-50">
              <div className="text-center px-8 py-6">
                <h2
                  className="font-heading text-4xl sm:text-5xl mb-2 tracking-wide"
                  style={{
                    color:
                      gameOver.winner === localPlayer
                        ? "#FFD700"
                        : "#CE1126",
                  }}
                >
                  {gameOver.winner === localPlayer
                    ? "Ya Mon! You Win!"
                    : `${opponentName} Wins!`}
                </h2>
                <p className="text-[#D4A857] text-xl mb-2 font-heading">
                  {winTypeLabels[gameOver.winType]}
                </p>
                <p className="text-[#F4E1C1] text-sm mb-6">
                  {gameOver.pointsWon} point{gameOver.pointsWon !== 1 ? "s" : ""}
                </p>

                {/* Rasta divider */}
                <div className="flex w-48 mx-auto mb-6 rounded overflow-hidden">
                  <div className="h-1 flex-1 bg-[#006B3F]" />
                  <div className="h-1 flex-1 bg-[#FFD700]" />
                  <div className="h-1 flex-1 bg-[#CE1126]" />
                </div>

                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handleBackToLobby}
                    className="rounded-xl bg-[#006B3F] px-6 py-3 text-lg font-bold text-[#FFD700] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    Back to Lobby
                  </button>
                  <button
                    onClick={handleBackToMenu}
                    className="rounded-xl bg-[#D4A857] px-6 py-3 text-lg font-bold text-[#1A1A0E] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    Main Menu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Link
        href={status === "playing" ? "/lobby" : "/"}
        className="mt-8 text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-lg"
      >
        &larr; {status === "playing" ? "Leave Game" : "Back to Menu"}
      </Link>

      {/* Bottom rasta stripe decoration */}
      <div className="fixed bottom-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>
    </div>
  );
}

// ── Main Play page ────────────────────────────────────────────────────

function PlayContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const difficulty = searchParams.get("difficulty") ?? "easy";
  const roomId = searchParams.get("roomId") ?? "";

  if (mode === "online" && roomId) {
    return <OnlinePlayContent roomId={roomId} />;
  }

  // Default: AI mode (including mode === "ai" or fallback)
  return <AIPlayContent difficulty={difficulty} />;
}

export default function PlayPage() {
  return (
    <main>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <p className="text-[#FFD700] text-2xl font-heading">Loading...</p>
          </div>
        }
      >
        <PlayContent />
      </Suspense>
    </main>
  );
}
