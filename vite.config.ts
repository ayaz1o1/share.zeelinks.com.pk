// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// `npm run build:static` sets STATIC_BUILD=1. That mode skips the serverless
// bundle and prerenders real HTML files (index.html, about/index.html, ...)
// into dist/client so the site can be hosted as plain static files
// (Firebase Hosting, GitHub Pages, any CDN).
const STATIC = process.env["STATIC_BUILD"] === "1";

export default defineConfig({
  ...(STATIC ? { nitro: false as const } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    ...(STATIC ? {} : { server: { entry: "server" } }),
    ...(STATIC
      ? {
          prerender: { enabled: true, crawlLinks: true },
          pages: [
            { path: "/" },
            { path: "/how-it-works" },
            { path: "/faq" },
            { path: "/about" },
            { path: "/contact" },
            { path: "/privacy" },
            { path: "/terms" },
            { path: "/cookies" },
          ],
        }
      : {}),
  },
});
