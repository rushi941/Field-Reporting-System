#!/usr/bin/env node
/**
 * Production start for Render (and similar).
 */
import { spawnSync } from "node:child_process";
import { migrateEnv, normalizeDatabaseUrl } from "./ensure-database-url.mjs";

function sleepMs(ms) {
  spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await new Promise((r) => setTimeout(r, ${ms}))`],
    { stdio: "ignore" },
  );
}

function run(cmd, args, env = process.env) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    env,
  });
  return result.status ?? 1;
}

function runMigrateWithRetry(maxAttempts = 3) {
  const env = migrateEnv();
  const host = env.DATABASE_URL?.match(/@([^/]+)/)?.[1] ?? "unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[db] migrate deploy (attempt ${attempt}/${maxAttempts}) → ${host}`);
    const status = run("npm", ["run", "db:migrate:deploy", "-w", "@frs/db"], env);
    if (status === 0) return 0;
    if (attempt < maxAttempts) {
      console.error(
        "[db] Migrate failed — retrying in 8s (Neon free tier may be waking up)…",
      );
      sleepMs(8000);
    }
  }
  return 1;
}

if (!process.env.DATABASE_URL) {
  console.error("");
  console.error("══════════════════════════════════════════════════════════");
  console.error(" DATABASE_URL is not set.");
  console.error(" Neon: use Direct connection string + ?sslmode=require");
  console.error(" Render → Environment → DATABASE_URL");
  console.error(" Also set JWT_SECRET. After deploy: npm run db:seed:admin");
  console.error("══════════════════════════════════════════════════════════");
  console.error("");
} else {
  const preview = normalizeDatabaseUrl(process.env.DATABASE_URL);
  const host = preview?.match(/@([^/]+)/)?.[1] ?? "";
  if (process.env.DATABASE_URL.includes("-pooler")) {
    console.warn(
      "[db] DATABASE_URL uses Neon pooler. Migrations will use direct host automatically.",
    );
  }
  console.log(`[db] Runtime database host: ${host}`);

  const migrate = runMigrateWithRetry();
  if (migrate !== 0) {
    console.error("");
    console.error("══════════════════════════════════════════════════════════");
    console.error(" Prisma migrate failed (P1001 = cannot reach database)");
    console.error("");
    console.error(" Checklist:");
    console.error(" 1. Neon dashboard — project awake (not suspended/deleted)");
    console.error(" 2. Render → Environment → DATABASE_URL is correct");
    console.error(" 3. Use Neon DIRECT URL (no -pooler) or keep pooler — we auto-fix migrate");
    console.error(" 4. URL must include sslmode=require");
    console.error(" 5. Password special chars URL-encoded (@ → %40, etc.)");
    console.error("══════════════════════════════════════════════════════════");
    console.error("");
    process.exit(migrate);
  }
}

const start = run("npm", ["run", "start", "-w", "@frs/api"]);
process.exit(start);
