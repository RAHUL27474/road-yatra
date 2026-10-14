import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a preview/dev server build into a separate folder (e.g. NEXT_DIST_DIR=.next-preview) without touching production's .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Serve /public images as-is. The vercel.json catch-all rewrite sends /_next/image to the app, where it 404s on Vercel.
  images: { unoptimized: true },
};

export default nextConfig;
