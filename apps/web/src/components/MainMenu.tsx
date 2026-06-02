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
    <div className="animated-bg flex min-h-dvh flex-col items-center justify-center px-4">
      {/* Rasta stripe decoration - top */}
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50 cursor-pointer">
        <div className="rasta-segment flex-1 bg-green origin-top" />
        <div className="rasta-segment flex-1 bg-gold origin-top" />
        <div className="rasta-segment flex-1 bg-red origin-top" />
      </div>

      {/* Title section */}
      <div className="text-center mb-6 sm:mb-12 animate-fade-in-up">
        <h1 className="title-glow font-spice text-4xl sm:text-6xl md:text-7xl lg:text-8xl text-gold tracking-wide">
          Back Ya&apos;Mon!
        </h1>
        <p className="animate-fade-in animate-delay-100 mt-3 text-gold-dim/60 text-sm sm:text-base font-heading tracking-widest uppercase">
          Backgammon with riddim
        </p>
      </div>

      {/* Rasta divider */}
      <div className="flex w-48 sm:w-64 mb-6 sm:mb-10 rounded overflow-hidden animate-fade-in animate-delay-200">
        <div className="h-1.5 flex-1 bg-green" />
        <div className="h-1.5 flex-1 bg-gold" />
        <div className="h-1.5 flex-1 bg-red" />
      </div>

      {/* Navigation buttons */}
      <div className="flex flex-col gap-4 w-full max-w-xs sm:max-w-sm">
        <button
          onClick={() => setShowDifficulty(true)}
          className="animate-fade-in-up animate-delay-200 w-full rounded-2xl wood-btn wood-btn-green px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl font-bold text-gold shadow-lg interactive-btn cursor-pointer hover:shadow-[0_0_20px_rgba(0,107,63,0.4)] font-heading"
        >
          Single Player
        </button>

        <Link
          href="/lobby"
          className="animate-fade-in-up animate-delay-300 w-full rounded-2xl wood-btn wood-btn-bamboo px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl font-bold text-night text-center shadow-lg interactive-btn hover:shadow-[0_0_20px_rgba(212,168,87,0.4)] font-heading"
        >
          Play Online
        </Link>

        <Link
          href="/create"
          className="animate-fade-in-up animate-delay-350 w-full rounded-2xl border-2 border-gold-dim bg-surface px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl font-bold text-gold-dim text-center shadow-lg interactive-btn hover:shadow-[0_0_20px_rgba(212,168,87,0.3)] hover:text-gold hover:border-gold transition-colors duration-200 font-heading"
        >
          Creation Station
        </Link>

      </div>

      {/* Bottom rasta stripe decoration */}
      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50 cursor-pointer">
        <div className="rasta-segment flex-1 bg-green origin-bottom" />
        <div className="rasta-segment flex-1 bg-gold origin-bottom" />
        <div className="rasta-segment flex-1 bg-red origin-bottom" />
      </div>
    </div>
  );
}
