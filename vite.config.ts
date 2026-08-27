import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// ZeeShare is a client-side SPA.
// Firebase Hosting serves the static output from dist/client.
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],

  server: {
    host: true,
    port: 8080,
  },

  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
});
