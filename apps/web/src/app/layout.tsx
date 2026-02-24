import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Backyamon - Ya Mon!",
  description: "Rastafarian-themed backgammon game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#1A1A0E] text-[#F4E1C1] min-h-screen">
        {children}
      </body>
    </html>
  );
}
