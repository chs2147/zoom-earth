import { defineConfig } from "vite";

// Relative base so the built site works from any static host path.
export default defineConfig({
  base: "./",
  build: { chunkSizeWarningLimit: 1500 },
});
