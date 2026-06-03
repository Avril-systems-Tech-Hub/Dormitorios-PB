import type { NextConfig } from "next";
import path from "path";

const projectRoot = path.resolve(__dirname);

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
