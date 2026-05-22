import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const projectRoot = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(projectRoot, "../../.env") });

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
