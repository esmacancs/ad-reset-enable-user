import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs", "jsonwebtoken", "ldapjs"],
  allowedDevOrigins: [
    "http://21.0.3.130:3000",
    "http://21.0.3.130:81",
    "http://10.177.19.200:3000",
    "http://10.177.19.200:81",
  ],
  turbopack: {
    resolveAlias: {
      "@prisma/client": "@prisma/client",
    },
  },
};

export default nextConfig;
