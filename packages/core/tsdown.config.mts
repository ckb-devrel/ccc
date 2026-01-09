import { defineConfig } from "tsdown";

const common = {
  minify: true,
  dts: true,
  platform: "neutral" as const,
  exports: true,
};

const entry = {
  index: "src/index.ts",
  barrel: "src/barrel.ts",
  advanced: "src/advanced.ts",
  advancedBarrel: "src/advancedBarrel.ts",
} as const;

export default defineConfig(
  (
    [
      {
        entry,
        format: "esm",
        copy: "./misc/basedirs/dist/*",
      },
      {
        entry,
        noExternal: [
          "@noble/curves/*",
          "@noble/hashes/*",
          "@noble/ciphers/*",
        ] as string[],
        format: "cjs",
        outDir: "dist.commonjs",
        copy: "./misc/basedirs/dist.commonjs/*",
      },
    ] as const
  ).map((c) => ({ ...c, ...common })),
);
