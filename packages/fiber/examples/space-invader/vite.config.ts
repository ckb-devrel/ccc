import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/node1-api": {
        target: "http://localhost:8227",
        changeOrigin: true,
      },
      "/node2-api": {
        target: "http://localhost:8237",
        changeOrigin: true,
      },
    },
  },
});
