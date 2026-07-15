#!/usr/bin/env node
/**
 * Production start for Render (and similar).
 */
import { spawnSync } from "node:child_process";

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
  console.error(" DATABASE_URL is not set.");
  console.error(" Neon: paste connection string with ?sslmode=require");
  console.error(" Also set JWT_SECRET. After deploy: npm run db:seed");
  console.error("══════════════════════════════════════════════════════════");
  console.error("");
} else {
  const migrate = run("npm", ["run", "db:migrate:deploy", "-w", "@frs/db"]);
  if (migrate !== 0) {
    console.error("Prisma migrate failed — check Neon DATABASE_URL + sslmode=require");
    process.exit(migrate);
  }
}

const start = run("npm", ["run", "start", "-w", "@frs/api"]);
process.exit(start);
