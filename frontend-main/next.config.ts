import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  output: 'standalone',
  experimental: {
    // Opt in to security upgrades offered by the agent upgrade flow
    agentUpgrade: 'security',
  },
};

export default nextConfig;




