import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ВАЖНО: никакого require(), никакого module.exports — только ESM

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
  },

  build: {
    outDir: "dist",
  },
});
