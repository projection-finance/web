import type { NextConfig } from "next";

/** @see https://nextjs.org/docs/app/api-reference/config/next-config-js */
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["ethers", "@aave/contract-helpers", "@aave/math-utils"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
