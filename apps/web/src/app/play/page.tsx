"use client";

export default function PlayPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-[#FFD700]">Game Board</h1>
      <p className="mt-4 text-[#006B3F]">PixiJS canvas will render here</p>
      <div className="mt-8 w-[800px] h-[500px] bg-[#2a2a1e] rounded-lg border-2 border-[#8B4513] flex items-center justify-center">
        <span className="text-[#8B4513]">Canvas Placeholder</span>
      </div>
    </main>
  );
}
