#!/usr/bin/env node
/**
 * Production start for Render (and similar).
 * Requires DATABASE_URL for migrations + API; still boots the HTTP server
 * if missing so the UI can load and logs show a clear fix.
 */
import { spawnSync } from "node:child_process";

/** Neon / Prisma: if only DATABASE_URL is set, reuse it for migrations */
if (process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  return result.status ?? 1;
}

if (!process.env.DATABASE_URL) {
  console.error("");
  console.error("══════════════════════════════════════════════════════════");
  console.error(" DATABASE_URL is not set on this service.");
  console.error(" Neon: paste the connection string (add ?sslmode=require).");
  console.error(" Also set JWT_SECRET, then Redeploy. After up: npm run db:seed");
  console.error("══════════════════════════════════════════════════════════");
  console.error("");
} else {
  const migrate = run("npm", ["run", "db:migrate:deploy", "-w", "@frs/db"]);
  if (migrate !== 0) {
    console.error("Prisma migrate deploy failed. Check DATABASE_URL / DIRECT_URL.");
    process.exit(migrate);
  }
}

const start = run("npm", ["run", "start", "-w", "@frs/api"]);
process.exit(start);
