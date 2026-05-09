import type { NextConfig } from "next";

/** Comma-separated hostnames for dev access (e.g. phone on Wi‑Fi). See NEXT_DEV_ALLOWED_ORIGINS in .env.example */
const allowedDevOrigins =
  process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  // Required for Firebase App Hosting / Cloud Run (self-contained Node server bundle).
  output: "standalone",
  // Next 15 webpack must not bundle firebase-admin (subpath exports: firebase-admin/app, /firestore).
  serverExternalPackages: ["firebase-admin"],
  // Flat-config + eslint-config-next mismatch can fail Cloud builds; run `npm run lint` locally.
  eslint: { ignoreDuringBuilds: true },
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
