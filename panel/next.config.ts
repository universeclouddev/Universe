import type { NextConfig } from "next";
import { collectDevOrigins } from "./lib/dev-origins";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(process.env.NODE_ENV !== "production" && {
    allowedDevOrigins: collectDevOrigins(),
  }),
};

export default nextConfig;
