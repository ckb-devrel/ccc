import { defineConfig, coverageConfigDefaults } from "vitest/config";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env file
config({ path: resolve(process.cwd(), ".env") });

export default defineConfig({
  test: {
    projects: ["packages/core", "packages/spore"],
    coverage: {
      include: ["packages/core", "packages/spore"],
      exclude: [
        "**/dist/**",
        "**/dist.commonjs/**",
        ...coverageConfigDefaults.exclude,
      ],
    },
    env: {
      PRIVATE_KEY: process.env.PRIVATE_KEY,
    },
  },
});
