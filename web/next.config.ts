import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Bound build-worker memory on local and serverless build machines.
  experimental: { cpus: 2 },
};

export default nextConfig;
