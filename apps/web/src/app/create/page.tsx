import Link from "next/link";

const cards = [
  {
    title: "Design a Piece",
    description: "Create custom game pieces with your own style",
    href: "/create/piece",
    accent: "#FFD700",
  },
  {
    title: "Upload Sound Effect",
    description: "Add your own sounds to the game",
    href: "/create/sound",
    accent: "#006B3F",
  },
  {
    title: "Upload Music",
    description: "Bring your own riddims to the board",
    href: "/create/music",
    accent: "#CE1126",
  },
];

export default function CreatePage() {
  return (
    <div className="animated-bg flex min-h-screen flex-col items-center justify-center px-4 py-16">
      {/* Rasta stripe decoration - top */}
      <div className="rasta-stripe-bar fixed top-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-[#006B3F] origin-top" />
        <div className="rasta-segment flex-1 bg-[#FFD700] origin-top" />
        <div className="rasta-segment flex-1 bg-[#CE1126] origin-top" />
      </div>

      {/* Title section */}
      <div className="text-center mb-4 animate-fade-in-up">
        <h1 className="title-glow font-spice text-4xl sm:text-6xl md:text-7xl text-[#FFD700] tracking-wide">
          Creation Station
        </h1>
      </div>

      <p className="animate-fade-in animate-delay-100 text-[#D4A857] text-lg mb-10 font-heading">
        Make it yours
      </p>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-xs sm:max-w-3xl">
        {cards.map((card, index) => (
          <Link
            key={card.href}
            href={card.href}
            className="animate-fade-in-up group rounded-2xl bg-[#2a2a1e] p-6 text-left shadow-lg game-card"
            style={{
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: card.accent,
              animationDelay: `${(index + 1) * 0.1}s`,
            }}
          >
            <h3
              className="font-heading text-2xl mb-3"
              style={{ color: card.accent }}
            >
              {card.title}
            </h3>
            <p className="text-[#F4E1C1] text-sm font-heading">
              {card.description}
            </p>
            <div
              className="mt-4 h-1 rounded-full opacity-60 transition-opacity duration-200 group-hover:opacity-100"
              style={{ backgroundColor: card.accent }}
            />
          </Link>
        ))}
      </div>

      {/* Secondary links */}
      <div className="flex gap-6 mt-10 animate-fade-in animate-delay-400">
        <Link
          href="/my-stuff"
          className="text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-base font-heading interactive-btn"
        >
          My Creations
        </Link>
        <Link
          href="/gallery"
          className="text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-base font-heading interactive-btn"
        >
          Gallery
        </Link>
      </div>

      {/* Back link */}
      <Link
        href="/"
        className="mt-8 text-[#D4A857] hover:text-[#FFD700] transition-colors duration-200 text-lg min-h-[44px] flex items-center interactive-btn font-heading"
      >
        &larr; Back to Menu
      </Link>

      {/* Rasta stripe decoration - bottom */}
      <div className="rasta-stripe-bar fixed bottom-0 left-0 right-0 flex h-2 z-50">
        <div className="rasta-segment flex-1 bg-[#006B3F] origin-bottom" />
        <div className="rasta-segment flex-1 bg-[#FFD700] origin-bottom" />
        <div className="rasta-segment flex-1 bg-[#CE1126] origin-bottom" />
      </div>
    </div>
  );
}
