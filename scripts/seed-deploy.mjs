/**
 * Apply full dev/demo seed to Neon / production.
 * Usage: DATABASE_URL="postgresql://..." node scripts/seed-deploy.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { migrateEnv } from "./ensure-database-url.mjs";

if (!process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const env = migrateEnv();

console.log("[db] migrate deploy (Neon)…");
const migrate = spawnSync("node", ["scripts/migrate-deploy.mjs"], {
  stdio: "inherit",
  env,
  cwd: root,
});
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

console.log("[db] seed demo data…");
const seed = spawnSync("npm", ["run", "db:seed", "-w", "@frs/db"], {
  stdio: "inherit",
  env,
  shell: true,
  cwd: root,
});
process.exit(seed.status ?? 1);
