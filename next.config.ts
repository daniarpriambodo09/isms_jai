import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/isms-jai",
  // NEXT_DIST_DIR=.next-verify npm run build → a check build in its own
  // folder, so it doesn't replace the files a running `next start` is serving.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ['pg', 'pg-connection-string', 'pgpass'],
  turbopack: {},
};

export default nextConfig;