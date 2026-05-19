import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Receipt photos from phones often exceed the default 1 MB limit.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
