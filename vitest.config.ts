import { defineConfig, coverageConfigDefaults } from "vitest/config";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env file
config({ path: resolve(process.cwd(), ".env") });

export default defineConfig({
  test: {
    projects: ["packages/core"],
    coverage: {
      include: ["packages/core"],
      exclude: [
        "**/dist/**",
        "**/dist.commonjs/**",
        ...coverageConfigDefaults.exclude,
      ],
    }
  },
});
