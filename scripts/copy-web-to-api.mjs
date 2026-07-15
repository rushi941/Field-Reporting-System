#!/usr/bin/env node
/**
 * After Vite build, copy apps/web/dist → apps/api/public
 * so the API can serve the UI from a stable path next to itself
 * (works regardless of Render/npm workspace cwd).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "apps", "web", "dist");
const dest = path.join(root, "apps", "api", "public");

if (!fs.existsSync(path.join(src, "index.html"))) {
  console.error(`Web build missing: ${src}/index.html`);
  console.error("Run: npm run build -w @frs/web");
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied web UI → ${dest}`);
