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
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: true },
      { source: "/news", destination: "/", permanent: true },
      { source: "/pi", destination: "/host", permanent: true },
      { source: "/todos", destination: "/tasks", permanent: true },
      { source: "/containers", destination: "/host?tab=containers", permanent: true },
      { source: "/projects/:id/edit", destination: "/projects/:id?tab=settings", permanent: true },
    ];
  },
  // Ignore TypeScript type errors during build for faster iteration
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
