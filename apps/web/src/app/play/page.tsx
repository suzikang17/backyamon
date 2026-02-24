"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useCallback } from "react";
import Link from "next/link";
import { Player, type WinType } from "@backyamon/engine";
import { GameCanvas } from "@/components/GameCanvas";

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

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams.get("mode");
  const difficulty = searchParams.get("difficulty") ?? "easy";

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

      {mode === "ai" ? (
        <h1 className="font-heading text-4xl sm:text-5xl mb-4 tracking-wide">
          <span className="text-[#F4E1C1]">Playing vs </span>
          <span style={{ color: accentColor }}>{aiName}</span>
        </h1>
      ) : (
        <h1 className="font-heading text-4xl sm:text-5xl text-[#FFD700] mb-4 tracking-wide">
          Game Board
        </h1>
      )}

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
