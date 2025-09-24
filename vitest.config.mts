import { defineConfig, coverageConfigDefaults } from "vitest/config";

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
    },
  },
});
