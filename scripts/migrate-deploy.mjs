/**
 * Apply pending Prisma migrations (Neon / production).
 * Normalizes DATABASE_URL for Neon (sslmode, direct host for DDL).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { migrateEnv } from "./ensure-database-url.mjs";

if (!process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const env = migrateEnv();
const host = env.DATABASE_URL.match(/@([^/]+)/)?.[1] ?? "unknown";
console.log(`[db] migrate deploy → ${host}`);

const result = spawnSync("npm", ["run", "db:migrate:deploy", "-w", "@frs/db"], {
  stdio: "inherit",
  env,
  shell: true,
  cwd: fileURLToPath(new URL("..", import.meta.url)),
});

process.exit(result.status ?? 1);
