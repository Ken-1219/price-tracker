import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "store.playstation.com",
      },
      {
        protocol: "https",
        hostname: "image.api.playstation.com",
      },
      {
        protocol: "https",
        hostname: "vulcan.dl.playstation.net",
      },
      {
        protocol: "https",
        hostname: "apollo2.dl.playstation.net",
      },
      {
        protocol: "https",
        hostname: "**.dl.playstation.net",
      },
    ],
  },
};

export default nextConfig;
