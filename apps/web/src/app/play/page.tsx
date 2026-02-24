"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

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

function PlayContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const difficulty = searchParams.get("difficulty") ?? "easy";

  const aiName = aiNames[difficulty] ?? "Beach Bum";
  const accentColor = difficultyColors[difficulty] ?? "#FFD700";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Rasta stripe decoration */}
      <div className="fixed top-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>

      {mode === "ai" ? (
        <h1 className="font-heading text-4xl sm:text-5xl mb-2 tracking-wide">
          <span className="text-[#F4E1C1]">Playing vs </span>
          <span style={{ color: accentColor }}>{aiName}</span>
        </h1>
      ) : (
        <h1 className="font-heading text-4xl sm:text-5xl text-[#FFD700] mb-2 tracking-wide">
          Game Board
        </h1>
      )}

      <p className="text-[#006B3F] mb-8 text-lg">
        PixiJS canvas will render here
      </p>

      {/* Canvas placeholder */}
      <div className="w-full max-w-[800px] aspect-[8/5] bg-[#2a2a1e] rounded-2xl border-2 border-[#8B4513] flex items-center justify-center shadow-lg">
        <span className="text-[#8B4513] text-lg">Canvas Placeholder</span>
      </div>

      <Link
        href="/"
        className="mt-10 text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-lg"
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
