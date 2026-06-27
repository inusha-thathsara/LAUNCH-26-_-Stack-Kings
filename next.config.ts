import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Emit a self-contained server bundle for a lean container image.
  output: "standalone",
};

export default nextConfig;
