import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/core", "packages/type-id"],
    coverage: {
      include: ["packages/core", "packages/type-id"],
      exclude: [
        "**/dist/**",
        "**/dist.commonjs/**",
        ...coverageConfigDefaults.exclude,
      ],
    },
  },
});
