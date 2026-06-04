import type { NextConfig } from "next";
import path from "path";

const projectRoot = path.resolve(__dirname);

const guestSessionSecretKey = ["GUEST", "SESSION", "SECRET"].join("_");
if (process.env.VERCEL === "1" && !process.env[guestSessionSecretKey]?.trim()) {
  console.warn(
    "[build] GUEST_SESSION_SECRET is not set; guest sessions will derive a signing key from SUPABASE_SERVICE_ROLE_KEY at runtime.",
  );
}

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Next from using ~/yarn.lock or other parent lockfiles as workspace root.
    root: projectRoot,
  },
  experimental: {
    serverActions: {
      // Receipt photos from phones often exceed the default 1 MB limit.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
