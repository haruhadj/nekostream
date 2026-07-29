import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ships a minimal self-contained server bundle, so the runtime image doesn't
  // need the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
