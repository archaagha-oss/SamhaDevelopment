import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Prefer TypeScript sources over their stale .js shadows in src/.
  // Default Vite order is .mjs > .js > .ts > .tsx, which would resolve to
  // the (out-of-date) tsc output committed alongside each component.
  resolve: {
    extensions: [".mjs", ".mts", ".ts", ".tsx", ".jsx", ".js", ".json"],
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
