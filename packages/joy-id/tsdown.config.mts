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

// ESM-only, so bundled for CommonJS.
const bundleDeps: string[] = [
  "@scure/btc-signer",
  "@scure/btc-signer/*",
  "@scure/base",
  "micro-packed",
  "@noble/curves",
  "@noble/curves/*",
  "@noble/hashes",
  "@noble/hashes/*",
];

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
