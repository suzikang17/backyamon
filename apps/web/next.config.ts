import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@backyamon/engine"],
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Skip the service worker in dev so it doesn't cache while iterating.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
