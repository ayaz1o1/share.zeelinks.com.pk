// Runs after `npm run build:static`.
// Adds a 404.html fallback (used by GitHub Pages / static hosts) that mirrors
// the prerendered shell, so unknown URLs still boot the app and render the
// in-app 404 page.
import { copyFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const dir = resolve(process.cwd(), "dist/client");
const index = resolve(dir, "index.html");

try {
  await access(index);
  await copyFile(index, resolve(dir, "404.html"));
  console.log("[static] wrote dist/client/404.html");
} catch (err) {
  console.warn("[static] skipped 404.html:", err.message);
}
