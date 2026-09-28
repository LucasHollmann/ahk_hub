import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import type { NextConfig } from "next";

const nextConfig = (phase: string): NextConfig => ({
  output: "export",
  assetPrefix: phase === PHASE_DEVELOPMENT_SERVER ? undefined : "./",
});

export default nextConfig;
