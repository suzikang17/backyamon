import Link from "next/link";

export default function LobbyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Rasta stripe decoration */}
      <div className="fixed top-0 left-0 right-0 flex h-2">
        <div className="flex-1 bg-[#006B3F]" />
        <div className="flex-1 bg-[#FFD700]" />
        <div className="flex-1 bg-[#CE1126]" />
      </div>

      <h1 className="font-heading text-5xl sm:text-6xl text-[#FFD700] mb-4 tracking-wide">
        Online Lobby
      </h1>

      <div className="rounded-2xl bg-[#2a2a1e] border-2 border-[#8B4513] px-12 py-10 text-center shadow-lg">
        <p className="text-3xl font-heading text-[#006B3F] mb-2">
          Coming Soon
        </p>
        <p className="text-xl text-[#D4A857]">Ya Mon!</p>
        <p className="mt-4 text-sm text-[#F4E1C1] opacity-60">
          Multiplayer matchmaking is on the way. Stay tuned!
        </p>
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
    </main>
  );
}
