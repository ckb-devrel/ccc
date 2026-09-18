import { defineConfig, coverageConfigDefaults } from "vitest/config";

const packages = [
  "packages/connector",
  "packages/core",
  "packages/did-ckb",
  "packages/joy-id",
  "packages/libp2p",
  "packages/nip07",
  "packages/okx",
  "packages/ssri",
  "packages/type-id",
  "packages/co-build",
  "packages/coin",
  "packages/nip07",
  "packages/uni-sat",
  "packages/xverse",
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
