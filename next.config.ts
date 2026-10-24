import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@ai-sdk/code-mode", "run"],
  poweredByHeader: false,
  reactStrictMode: true,
};
export default config;
