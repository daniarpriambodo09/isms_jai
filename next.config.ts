import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/isms-jai",
  serverExternalPackages: ['pg', 'pg-connection-string', 'pgpass'],
  turbopack: {},
};

export default nextConfig;