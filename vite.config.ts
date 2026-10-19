import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Netlify Function directory is excluded from the Vite build so that
// `pg` and the Node-only runtime are never pulled into the browser bundle.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          katex: ["katex"],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
