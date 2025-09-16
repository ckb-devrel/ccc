import { defineConfig, coverageConfigDefaults } from "vitest/config";

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
  },
});
