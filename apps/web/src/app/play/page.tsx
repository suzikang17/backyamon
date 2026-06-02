"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Player, type GameState, type WinType } from "@backyamon/engine";
import { GameCanvas } from "@/components/GameCanvas";
import { OnlineGameCanvas } from "@/components/OnlineGameCanvas";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SocketClient } from "@/multiplayer/SocketClient";
import { PlayerLink } from "@/components/PlayerLink";

const aiNames: Record<string, string> = {
  easy: "Beach Bum",
  medium: "Selecta",
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

// ── Particle generators for win celebrations ─────────────────────────

function YaMonParticles() {
  return (
    <div className="ya-mon-particles">
      {Array.from({ length: 20 }, (_, i) => (
        <div key={i} className="ya-mon-particle" />
      ))}
    </div>
  );
}

function BigYaMonEffect() {
  return (
    <>
      <div className="big-ya-mon-flash" />
      <div className="ya-mon-particles">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="ya-mon-particle" />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <div key={`big-${i}`} className="ya-mon-particle big-ya-mon-particle" />
        ))}
      </div>
    </>
  );
}

function MassiveYaMonEffect() {
  return (
    <>
      <div className="massive-darken" />
      <div className="massive-gold-ring" />
      <div className="ya-mon-particles" style={{ zIndex: 3 }}>
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="ya-mon-particle" />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <div key={`massive-${i}`} className="ya-mon-particle massive-particle" />
        ))}
      </div>
    </>
  );
}

// ── Game Over Overlay component ──────────────────────────────────────

function GameOverOverlay({
  winner,
  winType,
  isPlayerWin,
  winnerName,
  onPlayAgain,
  onBackAction,
  backLabel,
}: {
  winner: Player;
  winType: WinType;
  isPlayerWin: boolean;
  winnerName: string;
  onPlayAgain?: () => void;
  onBackAction: () => void;
  backLabel: string;
}) {
  const overlayClass = isPlayerWin ? "ya-mon-overlay" : "loss-overlay";

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-night/85 rounded-2xl z-50 ${overlayClass}`}
    >
      {/* Win celebration effects */}
      {isPlayerWin && winType === "ya_mon" && <YaMonParticles />}
      {isPlayerWin && winType === "big_ya_mon" && <BigYaMonEffect />}
      {isPlayerWin && winType === "massive_ya_mon" && <MassiveYaMonEffect />}

      <div className="text-center px-4 sm:px-6 md:px-8 py-6 relative z-10">
        <h2
          className={`font-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-2 tracking-wide ${
            isPlayerWin ? "title-glow" : ""
          }`}
          style={{
            color: winner === Player.Gold ? "var(--color-gold)" : "var(--color-red)",
          }}
        >
          {winnerName}
        </h2>
        <p className="text-gold-dim text-lg sm:text-xl mb-6 font-heading">
          {winTypeLabels[winType]}
        </p>

        {/* Rasta divider */}
        <div className="flex w-36 sm:w-48 mx-auto mb-6 rounded overflow-hidden">
          <div className="h-1 flex-1 bg-green" />
          <div className="h-1 flex-1 bg-gold" />
          <div className="h-1 flex-1 bg-red" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center w-full sm:w-auto">
          {onPlayAgain && (
            <button
              onClick={onPlayAgain}
              className="rounded-2xl bg-green wood-btn wood-btn-green px-6 py-3 text-lg font-bold text-gold shadow-lg interactive-btn cursor-pointer min-h-[44px] font-heading"
            >
              Play Again
            </button>
          )}
          <button
            onClick={onBackAction}
            className="rounded-2xl bg-gold-dim wood-btn wood-btn-bamboo px-6 py-3 text-lg font-bold text-night shadow-lg interactive-btn cursor-pointer min-h-[44px] font-heading"
          >
            {backLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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
    <div className="animated-bg flex h-dvh overflow-hidden flex-col items-center justify-start sm:justify-center px-2 sm:px-4 pt-4 pb-2 sm:py-4">
      {/* Rasta stripe decoration */}
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-green origin-top" />
        <div className="rasta-segment flex-1 bg-gold origin-top" />
        <div className="rasta-segment flex-1 bg-red origin-top" />
      </div>

      <div className="w-full max-w-[900px] mb-1 px-2 sm:px-0">
        <Link
          href="/"
          className="text-gold-dim hover:text-gold transition-colors duration-200 text-sm min-h-[44px] flex items-center interactive-btn font-heading"
        >
          &larr; Back to Menu
        </Link>
      </div>

      {/* Game canvas */}
      <div className="relative w-full max-w-[900px] animate-fade-in-scale">
        <GameCanvas
          key={gameKey}
          difficulty={difficulty}
          onGameOver={handleGameOver}
        />

        {/* Game Over overlay */}
        {gameOver && (
          <GameOverOverlay
            winner={gameOver.winner}
            winType={gameOver.winType}
            isPlayerWin={gameOver.winner === Player.Gold}
            winnerName={
              gameOver.winner === Player.Gold
                ? "You Win!"
                : `${aiName} Wins!`
            }
            onPlayAgain={handlePlayAgain}
            onBackAction={handleBackToMenu}
            backLabel="Back to Menu"
          />
        )}
      </div>

      {/* Bottom rasta stripe decoration */}
      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-green origin-bottom" />
        <div className="rasta-segment flex-1 bg-gold origin-bottom" />
        <div className="rasta-segment flex-1 bg-red origin-bottom" />
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

        // Auto-rejoin room when socket.io reconnects after a drop
        client.onReconnect(async () => {
          if (destroyed) return;
          try {
            await client.register();
            const id = client.getIdentity();
            if (id) {
              client.reconnectToGame(id.playerId, roomId);
            }
          } catch {
            // reconnect-to-game will emit room-joined or error
          }
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
    <div className="animated-bg flex h-dvh overflow-hidden flex-col items-center justify-start sm:justify-center px-2 sm:px-4 pt-4 pb-2 sm:py-4">
      {/* Rasta stripe decoration */}
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-green origin-top" />
        <div className="rasta-segment flex-1 bg-gold origin-top" />
        <div className="rasta-segment flex-1 bg-red origin-top" />
      </div>

      <div className="w-full max-w-[900px] mb-1 px-2 sm:px-0">
        <Link
          href={status === "playing" ? "/lobby" : "/"}
          className="text-gold-dim hover:text-gold transition-colors duration-200 text-sm min-h-[44px] flex items-center interactive-btn font-heading"
        >
          &larr; {status === "playing" ? "Leave Game" : "Back to Menu"}
        </Link>
      </div>

      {/* Loading / Waiting state */}
      {(status === "connecting" || status === "waiting") && (
        <div className="animate-fade-in-scale rounded-2xl bg-surface border-2 border-wood px-8 sm:px-12 py-8 sm:py-10 text-center shadow-lg">
          <div className="flex justify-center mb-4">
            <div className="rasta-spinner" />
          </div>
          <p className="text-gold font-heading text-xl sm:text-2xl mb-2">
            {status === "connecting"
              ? "Connecting to server..."
              : "Joining game..."}
          </p>
          <p className="text-gold-dim text-sm font-heading">Room: {roomId}</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="animate-fade-in-scale rounded-2xl bg-surface border-2 border-red px-8 sm:px-12 py-8 sm:py-10 text-center shadow-lg">
          <p className="text-red font-heading text-xl sm:text-2xl mb-2">
            Connection Error
          </p>
          <p className="text-gold-dim text-sm mb-6 font-heading">{error}</p>
          <button
            onClick={handleBackToLobby}
            className="rounded-2xl bg-green wood-btn wood-btn-green px-6 py-3 text-lg font-bold text-gold shadow-lg interactive-btn cursor-pointer min-h-[44px] font-heading"
          >
            Back to Lobby
          </button>
        </div>
      )}

      {/* Game canvas for online play */}
      {status === "playing" && initialState && socketRef.current && (
        <div className="relative w-full max-w-[900px] animate-fade-in-scale">
          <OnlineGameCanvas
            socketClient={socketRef.current}
            roomId={roomId}
            localPlayer={localPlayer}
            initialState={initialState}
            opponentName={opponentName}
            onGameOver={handleGameOver}
            title={
              <span className="font-heading text-base sm:text-lg tracking-wide">
                <span className="text-cream">vs </span>
                <PlayerLink username={opponentName} className="text-red font-heading" />
              </span>
            }
          />

          {/* Game Over overlay */}
          {gameOver && (
            <GameOverOverlay
              winner={gameOver.winner}
              winType={gameOver.winType}
              isPlayerWin={gameOver.winner === localPlayer}
              winnerName={
                gameOver.winner === localPlayer
                  ? "Ya Mon! You Win!"
                  : `${opponentName} Wins!`
              }
              onBackAction={handleBackToLobby}
              backLabel="Back to Lobby"
            />
          )}
        </div>
      )}

      {/* Bottom rasta stripe decoration */}
      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-green origin-bottom" />
        <div className="rasta-segment flex-1 bg-gold origin-bottom" />
        <div className="rasta-segment flex-1 bg-red origin-bottom" />
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
            <div className="flex flex-col items-center gap-4">
              <div className="rasta-spinner" />
              <p className="text-gold text-xl sm:text-2xl font-heading rasta-pulse">
                Loading...
              </p>
            </div>
          </div>
        }
      >
        <ErrorBoundary>
          <PlayContent />
        </ErrorBoundary>
      </Suspense>
    </main>
  );
}
