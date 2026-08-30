import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "media.tenor.com" },
    ],
  },
};

export default nextConfig;
