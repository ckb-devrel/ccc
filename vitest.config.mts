import { defineConfig, coverageConfigDefaults } from "vitest/config";

const packages = [
  "packages/core",
  "packages/did-ckb",
  "packages/nip07",
  "packages/ssri",
  "packages/type-id",
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
