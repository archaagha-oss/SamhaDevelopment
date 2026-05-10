import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Vitest config for the web workspace.
//
// Mirrors the resolve.alias block in vite.config.ts so component imports like
// `@/components/...` work the same way under test as they do at build time.
// Kept narrow on purpose: no global coverage thresholds yet (see Sprint 3 in
// CI_TEST_MATRIX.md — gates are deliberately off while the suite is small so
// the first PRs aren't blocked).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    extensions: [".tsx", ".ts", ".mjs", ".mts", ".jsx", ".js", ".json"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    css: false,
  },
});
