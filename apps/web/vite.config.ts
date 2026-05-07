import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Prefer TypeScript sources over committed .js shadows so edits to .tsx
  // files actually take effect (the repo carries stale dist .js next to each
  // .tsx). Default order would resolve .js first.
  resolve: {
    extensions: [".tsx", ".ts", ".mjs", ".mts", ".jsx", ".js", ".json"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
