import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/isms-jai",
  // NEXT_DIST_DIR=.next-verify npm run build → a check build in its own
  // folder, so it doesn't replace the files a running `next start` is serving.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // pdfjs-dist: read on the server to find the signature boxes of a Working
  // Standard (lib/auto-slots.ts) — loaded as-is by Node, not bundled.
  serverExternalPackages: ['pg', 'pg-connection-string', 'pgpass', 'pdfjs-dist'],
  turbopack: {},
};

export default nextConfig;