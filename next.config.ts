import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
};

module.exports = {
  env: {
    PORT: 8080,
  },
};

export default nextConfig;
