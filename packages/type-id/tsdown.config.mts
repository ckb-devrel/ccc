import { defineConfig } from "tsdown";

const common = {
  minify: true,
  dts: true,
  platform: "neutral" as const,
  exports: true,
};

export default defineConfig(
  (
    [
      {
        entry: {
          index: "src/index.ts",
          barrel: "src/barrel.ts",
          advanced: "src/advanced.ts",
          advancedBarrel: "src/advancedBarrel.ts",
        },
        format: "esm",
        copy: "./misc/basedirs/dist/*",
      },
      {
        entry: {
          index: "src/index.ts",
          barrel: "src/barrel.ts",
          advanced: "src/advanced.ts",
          advancedBarrel: "src/advancedBarrel.ts",
        },
        format: "cjs",
        outDir: "dist.commonjs",
        copy: "./misc/basedirs/dist.commonjs/*",
      },
    ] as const
  ).map((c) => ({ ...c, ...common })),
);
