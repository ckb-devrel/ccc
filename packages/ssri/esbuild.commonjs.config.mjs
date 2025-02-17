import * as esbuild from "esbuild";
import { dtsPlugin } from "esbuild-plugin-d.ts";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";
import { polyfillNode } from "esbuild-plugin-polyfill-node";
import fs from "node:fs/promises";
const tsconfig = JSON.parse(await fs.readFile("./tsconfig.commonjs.json"));
const profile = process.env.PROFILE;

await esbuild.build({
  entryPoints: ["./src/index.ts"],
  bundle: true,
  outdir: "dist.commonjs",
  plugins: [
    polyfillNode(),
    inlineWorkerPlugin({
      format: "iife",
    }),
    dtsPlugin({ tsconfig }),
  ],
  target: ["esnext"],
  platform: "browser",
  sourcemap: true,
  format: "esm",
  globalName: "CkbSsriExecutor",
  minify: profile === "prod",
  logLevel: "debug",
  tsconfig: "./tsconfig.commonjs.json",
});
