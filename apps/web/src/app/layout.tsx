import type { Metadata, Viewport } from "next";
import { Inter, Bangers } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bangers",
});

export const metadata: Metadata = {
  title: "Backyamon - Ya Mon!",
  description: "Play backgammon with Rastafarian vibes",
  openGraph: {
    title: "Backyamon - Ya Mon!",
    description: "Play backgammon with Rastafarian vibes",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1A0E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${bangers.variable} font-sans bg-[#1A1A0E] text-[#F4E1C1] min-h-screen antialiased`}
      >
        <div className="animate-fade-in">{children}</div>
      </body>
    </html>
  );
}
