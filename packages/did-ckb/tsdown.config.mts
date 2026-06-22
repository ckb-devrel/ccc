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
  plc: "src/plc/index.ts",
} as const;

const bundleDeps = [
  "@ipld/dag-cbor",
  "cborg", // By @ipld/dag-cbor
  "multiformats", // By @ipld/dag-cbor
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
