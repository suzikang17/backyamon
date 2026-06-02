import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Back Ya'Mon!",
    short_name: "BackYaMon",
    description: "Play backgammon with Rastafarian vibes",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#1A1A0E",
    theme_color: "#1A1A0E",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
