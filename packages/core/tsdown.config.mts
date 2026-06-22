import { defineConfig } from "tsdown";

const common = {
  minify: true,
  dts: true,
  platform: "neutral" as const,
  sourcemap: true,
  exports: true,
};

const entry = {
  index: "src/index.ts",
  barrel: "src/barrel.ts",
  advanced: "src/advanced.ts",
  advancedBarrel: "src/advancedBarrel.ts",
} as const;

const bundleDeps = [
  "@noble/curves",
  "@noble/hashes",
  "@noble/ciphers",
  "@noble/curves/*",
  "@noble/hashes/*",
  "@noble/ciphers/*",
  "bs58check",
  "bs58", // By bs58check
  "base-x", // By bs58 - bs58check
] as string[];

export default defineConfig(
  (
    [
      {
        entry,
        deps: {
          onlyBundle: [] as string[],
        },
        format: "esm",
        copy: "./misc/basedirs/dist/*",
      },
      {
        entry,
        deps: {
          alwaysBundle: bundleDeps,
          onlyBundle: bundleDeps,
        },
        format: "cjs",
        outDir: "dist.commonjs",
        copy: "./misc/basedirs/dist.commonjs/*",
      },
    ] as const
  ).map((c) => ({ ...c, ...common })),
);
