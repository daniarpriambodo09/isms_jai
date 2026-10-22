import type { NextConfig } from "next";

const ROOT_REDIRECT_PATHS = [
  '/',
  '/kebijakan-dasar-ISMS',
  '/prosedur-isms',
  '/standard-isms-p14',
  '/working-standard',
  '/form-aplikasi',
  '/kontrol-cs',
  '/rekap-foto-video',
  '/audits',
  '/education',
  '/form-review-dokumen',
  '/pengesahan',
  '/news',
  '/form-it-esign',
  '/registrasi-fingerprint',
  '/ijin-masuk-alat-it',
  '/ijin-foto-video',
  '/dashboard-admin',
  '/kelola-admin',
  '/kelola-approver-it',
  '/kelola-izin-alat-it',
  '/kelola-izin-area-special',
  '/kelola-permintaan-foto-video',
  '/kelola-pengesahan',
  '/kelola-jadwal',
  '/kelola-departemen',
  '/kelola-pic-approve',
  '/kelola-pos',
  '/kelola-kamera',
  '/kelola-smtp',
  '/kelola-hero-slides',
  '/kelola-tema',
  '/kelola-pernyataan-kebijakan',
  '/persetujuan-saya',
  '/persetujuan-area-special',
  '/admin-pos-security',
  '/admin-lobby',
  '/notifikasi',
  '/pengaturan',
  '/pratinjau-email',
  '/reset-password',
  '/konfirmasi-approval',
  '/foto-video-internal',
  '/foto-video-visitor',
  '/verifikasi-area-special',
  '/verifikasi-pengesahan',
  '/verifikasi/:path*',
  '/documents/:path*',
  '/api/:path*',
];

const nextConfig: NextConfig = {
  basePath: "/isms-jai",
  async redirects() {
    return ROOT_REDIRECT_PATHS.map((path) => ({
      source: path,
      basePath: false,
      destination: path === '/' ? '/isms-jai' : `/isms-jai${path}`,
      permanent: false,
    }));
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