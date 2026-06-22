import { defineConfig } from "tsdown";

const common = {
  minify: true,
  dts: false,
  platform: "neutral" as const,
  sourcemap: false,
  exports: false,
};

const entry = "src/*.ts" as const;

export default defineConfig({
  ...common,
  entry,
  deps: {
    onlyBundle: [] as string[],
  },
  format: "esm",
  copy: "./misc/basedirs/dist/*",
});
