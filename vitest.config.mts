import { defineConfig, coverageConfigDefaults } from "vitest/config";

const packages = [
  "packages/core",
  "packages/did-ckb",
  "packages/type-id",
  "packages/coin",
];

export default defineConfig({
  test: {
    projects: packages,
    coverage: {
      include: packages,
      exclude: [
        "**/dist/**",
        "**/dist.commonjs/**",
        ...coverageConfigDefaults.exclude,
      ],
    },
  },
});
