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
        },
        format: "esm",
        copy: "./misc/basedirs/dist/*",
      },
      {
        entry: {
          index: "src/index.ts",
          barrel: "src/barrel.ts",
        },
        noExternal: ["@ipld/dag-cbor"] as string[],
        format: "cjs",
        outDir: "dist.commonjs",
        copy: "./misc/basedirs/dist.commonjs/*",
      },
    ] as const
  ).map((c) => ({ ...c, ...common })),
);
