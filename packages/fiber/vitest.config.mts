import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    sequence: {
      shuffle: false,
    },
    coverage: {
      include: ["src/**/*.ts"],
    },
  },
});
