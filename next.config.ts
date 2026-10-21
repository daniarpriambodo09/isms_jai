import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/isms-jai",
  async redirects() {
    return [
      {
        source: '/',
        basePath: false,
        destination: '/isms-jai',
        permanent: false,
      },
      {
        source: '/registrasi-fingerprint',
        basePath: false,
        destination: '/isms-jai/registrasi-fingerprint',
        permanent: false,
      },
      {
        source: '/form-it-esign',
        basePath: false,
        destination: '/isms-jai/form-it-esign',
        permanent: false,
      },
      {
        source: '/persetujuan-saya',
        basePath: false,
        destination: '/isms-jai/persetujuan-saya',
        permanent: false,
      },
      {
        source: '/ijin-masuk-alat-it',
        basePath: false,
        destination: '/isms-jai/ijin-masuk-alat-it',
        permanent: false,
      },
      {
        source: '/form-aplikasi',
        basePath: false,
        destination: '/isms-jai/form-aplikasi',
        permanent: false,
      },
      {
        source: '/kontrol-cs',
        basePath: false,
        destination: '/isms-jai/kontrol-cs',
        permanent: false,
      },
      {
        source: '/api/:path*',
        basePath: false,
        destination: '/isms-jai/api/:path*',
        permanent: false,
      },
    ];
  },
  // NEXT_DIST_DIR=.next-verify npm run build → a check build in its own
  // folder, so it doesn't replace the files a running `next start` is serving.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // pdfjs-dist: read on the server to find the signature boxes of a Working
  // Standard (lib/auto-slots.ts) — loaded as-is by Node, not bundled.
  serverExternalPackages: ['pg', 'pg-connection-string', 'pgpass', 'pdfjs-dist'],
  turbopack: {},
};

export default nextConfig;