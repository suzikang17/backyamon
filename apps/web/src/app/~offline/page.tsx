import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline — Back Ya'Mon!",
};

export default function Offline() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-3xl text-gold">You&apos;re offline, mon</h1>
      <p className="text-cream/80 max-w-sm">
        No connection right now. Pages you&apos;ve already visited are cached and
        still playable — reconnect to load anything new.
      </p>
    </main>
  );
}
