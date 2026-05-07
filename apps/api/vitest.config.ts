import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setupEnv.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/__tests__/"],
    },
    include: ["src/**/*.test.ts", "src/**/*.unit.test.ts", "src/**/*.integration.test.ts"],
  },
});
