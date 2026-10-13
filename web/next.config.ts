import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a preview/dev server build into a separate folder (e.g. NEXT_DIST_DIR=.next-preview) without touching production's .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
