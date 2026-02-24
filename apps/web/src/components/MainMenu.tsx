"use client";

import { useState } from "react";
import Link from "next/link";
import DifficultySelect from "./DifficultySelect";

export default function MainMenu() {
  const [showDifficulty, setShowDifficulty] = useState(false);

  if (showDifficulty) {
    return (
      <div className="animate-fade-in-scale">
        <DifficultySelect onBack={() => setShowDifficulty(false)} />
      </div>
    );
  }

  return (
    <div className="animated-bg flex min-h-screen flex-col items-center justify-center px-4">
      {/* Rasta stripe decoration - top */}
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50 cursor-pointer">
        <div className="rasta-segment flex-1 bg-[#006B3F] origin-top" />
        <div className="rasta-segment flex-1 bg-[#FFD700] origin-top" />
        <div className="rasta-segment flex-1 bg-[#CE1126] origin-top" />
      </div>

      {/* Title section */}
      <div className="text-center mb-12 animate-fade-in-up">
        <h1 className="title-glow font-spice text-7xl sm:text-8xl md:text-9xl text-[#FFD700] tracking-wide">
          BACKYAMON
        </h1>
        <p className="mt-2 text-3xl sm:text-4xl font-heading text-[#006B3F] tracking-wider">
          Ya Mon!
        </p>
      </div>

      {/* Rasta divider */}
      <div className="flex w-64 mb-10 rounded overflow-hidden animate-fade-in animate-delay-200">
        <div className="h-1.5 flex-1 bg-[#006B3F]" />
        <div className="h-1.5 flex-1 bg-[#FFD700]" />
        <div className="h-1.5 flex-1 bg-[#CE1126]" />
      </div>

      {/* Navigation buttons */}
      <div className="flex flex-col gap-4 w-full max-w-xs sm:max-w-sm">
        <button
          onClick={() => setShowDifficulty(true)}
          className="animate-fade-in-up animate-delay-200 w-full rounded-2xl wood-btn wood-btn-green px-8 py-4 text-xl font-bold text-[#FFD700] shadow-lg interactive-btn cursor-pointer hover:shadow-[0_0_20px_rgba(0,107,63,0.4)]"
        >
          Single Player
        </button>

        <Link
          href="/lobby"
          className="animate-fade-in-up animate-delay-300 w-full rounded-2xl wood-btn wood-btn-bamboo px-8 py-4 text-xl font-bold text-[#1A1A0E] text-center shadow-lg interactive-btn hover:shadow-[0_0_20px_rgba(212,168,87,0.4)]"
        >
          Play Online
        </Link>

        <button
          disabled
          className="animate-fade-in-up animate-delay-400 w-full rounded-2xl bg-[#3a3a2e] px-8 py-4 text-xl font-bold text-[#8B4513] shadow-lg cursor-not-allowed opacity-60 relative"
        >
          Local Game
          <span className="block text-sm font-normal text-[#D4A857] mt-0.5">
            Coming Soon
          </span>
        </button>
      </div>

      {/* Bottom rasta stripe decoration */}
      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50 cursor-pointer">
        <div className="rasta-segment flex-1 bg-[#006B3F] origin-bottom" />
        <div className="rasta-segment flex-1 bg-[#FFD700] origin-bottom" />
        <div className="rasta-segment flex-1 bg-[#CE1126] origin-bottom" />
      </div>
    </div>
  );
}
