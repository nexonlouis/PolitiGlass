import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin Turbopack root so nested scripts/*/package-lock.json files don't confuse resolution.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
