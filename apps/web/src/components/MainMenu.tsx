"use client";

import { useState } from "react";
import Link from "next/link";
import DifficultySelect from "./DifficultySelect";

export default function MainMenu() {
  const [showDifficulty, setShowDifficulty] = useState(false);

  if (showDifficulty) {
    return <DifficultySelect onBack={() => setShowDifficulty(false)} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Rasta stripe decoration */}
      <div className="fixed top-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>

      {/* Title section */}
      <div className="text-center mb-12">
        <h1 className="font-heading text-7xl sm:text-8xl md:text-9xl text-[#FFD700] tracking-wide drop-shadow-[0_4px_8px_rgba(255,215,0,0.3)]">
          BACKYAMON
        </h1>
        <p className="mt-2 text-3xl sm:text-4xl font-heading text-[#006B3F] tracking-wider">
          Ya Mon!
        </p>
      </div>

      {/* Rasta divider */}
      <div className="flex w-64 mb-10 rounded overflow-hidden">
        <div className="h-1.5 flex-1 bg-[#006B3F]" />
        <div className="h-1.5 flex-1 bg-[#FFD700]" />
        <div className="h-1.5 flex-1 bg-[#CE1126]" />
      </div>

      {/* Navigation buttons */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => setShowDifficulty(true)}
          className="w-full rounded-xl bg-[#006B3F] px-8 py-4 text-xl font-bold text-[#FFD700] shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 hover:shadow-[0_0_20px_rgba(0,107,63,0.4)] active:scale-95 cursor-pointer"
        >
          Play vs AI
        </button>

        <Link
          href="/lobby"
          className="w-full rounded-xl bg-[#D4A857] px-8 py-4 text-xl font-bold text-[#1A1A0E] text-center shadow-lg transition-all duration-200 hover:brightness-110 hover:scale-105 hover:shadow-[0_0_20px_rgba(212,168,87,0.4)] active:scale-95"
        >
          Play Online
        </Link>

        <button
          disabled
          className="w-full rounded-xl bg-[#3a3a2e] px-8 py-4 text-xl font-bold text-[#8B4513] shadow-lg cursor-not-allowed opacity-60 relative"
        >
          Local Game
          <span className="block text-sm font-normal text-[#D4A857] mt-0.5">
            Coming Soon
          </span>
        </button>
      </div>

      {/* Bottom rasta stripe decoration */}
      <div className="fixed bottom-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>
    </div>
  );
}
