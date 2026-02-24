"use client";

import { useRouter } from "next/navigation";

interface DifficultySelectProps {
  onBack: () => void;
}

const opponents = [
  {
    name: "Beach Bum",
    difficulty: "easy" as const,
    badge: "Easy",
    flavor: "Just vibes, no stress",
    accent: "#006B3F",
    accentGlow: "rgba(0,107,63,0.3)",
  },
  {
    name: "Selector",
    difficulty: "medium" as const,
    badge: "Medium",
    flavor: "Knows the riddim",
    accent: "#FFD700",
    accentGlow: "rgba(255,215,0,0.3)",
  },
  {
    name: "King Tubby",
    difficulty: "hard" as const,
    badge: "Hard",
    flavor: "Dub master general",
    accent: "#CE1126",
    accentGlow: "rgba(206,17,38,0.3)",
  },
];

export default function DifficultySelect({ onBack }: DifficultySelectProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Rasta stripe decoration */}
      <div className="fixed top-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>

      <h2 className="font-heading text-4xl sm:text-5xl text-[#FFD700] mb-2 tracking-wide">
        Choose Your Opponent
      </h2>
      <p className="text-[#D4A857] text-lg mb-10">
        Who you wan fi challenge?
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
        {opponents.map((opp) => (
          <button
            key={opp.difficulty}
            onClick={() =>
              router.push(`/play?mode=ai&difficulty=${opp.difficulty}`)
            }
            className="group rounded-2xl bg-[#2a2a1e] p-6 text-left shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: opp.accent,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3
                className="font-heading text-2xl"
                style={{ color: opp.accent }}
              >
                {opp.name}
              </h3>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                style={{
                  backgroundColor: opp.accent,
                  color: opp.accent === "#FFD700" ? "#1A1A0E" : "#F4E1C1",
                }}
              >
                {opp.badge}
              </span>
            </div>
            <p className="text-[#F4E1C1] text-sm italic">&ldquo;{opp.flavor}&rdquo;</p>
            <div
              className="mt-4 h-1 rounded-full opacity-60 transition-opacity duration-200 group-hover:opacity-100"
              style={{ backgroundColor: opp.accent }}
            />
          </button>
        ))}
      </div>

      <button
        onClick={onBack}
        className="mt-10 text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-lg cursor-pointer"
      >
        &larr; Back to Menu
      </button>

      {/* Bottom rasta stripe decoration */}
      <div className="fixed bottom-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>
    </div>
  );
}
