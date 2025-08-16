import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/core", "packages/udt"],
    coverage: {
      include: ["packages/core", "packages/udt"],
      exclude: [
        "**/dist/**",
        "**/dist.commonjs/**",
        ...coverageConfigDefaults.exclude,
      ],
    },
  },
});
