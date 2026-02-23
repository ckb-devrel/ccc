import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    sequence: {
      shuffle: false,
    },
    coverage: {
      include: ["src/**/*.ts"],
    },
  },
});
