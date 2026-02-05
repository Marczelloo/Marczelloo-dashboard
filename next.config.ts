import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployment
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Ignore TypeScript type errors during build for faster iteration
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
