import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// Plain Vite single-page app. No SSR, no server runtime — the production
// output in dist/client is what Firebase Hosting serves.
export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: { host: true, port: 8080 },
  build: { outDir: "dist/client", emptyOutDir: true },
});
