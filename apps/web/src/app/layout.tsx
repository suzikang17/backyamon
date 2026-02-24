import type { Metadata, Viewport } from "next";
import { Inter, Reggae_One, Bungee, Bungee_Spice } from "next/font/google";
import Farewell from "@/components/Farewell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const reggaeOne = Reggae_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-reggae",
});

const bungee = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bungee",
});

const bungeeSpice = Bungee_Spice({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bungee-spice",
});

export const metadata: Metadata = {
  title: "Back Ya'Mon!",
  description: "Play backgammon with Rastafarian vibes",
  openGraph: {
    title: "Back Ya'Mon!",
    description: "Play backgammon with Rastafarian vibes",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1A0E",
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${reggaeOne.variable} ${bungee.variable} ${bungeeSpice.variable} font-sans bg-[#1A1A0E] text-[#F4E1C1] min-h-screen antialiased`}
      >
        <Farewell />
        <div className="animate-fade-in">{children}</div>
      </body>
    </html>
  );
}
