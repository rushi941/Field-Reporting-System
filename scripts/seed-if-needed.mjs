/**
 * Run full demo seed when Neon/production DB is missing master data.
 * Safe on empty DBs; skips when clients, users, and bid masters already exist.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { migrateEnv } from "./ensure-database-url.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const env = migrateEnv();
const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
});

function runSeed() {
  console.log("[db] Running full seed (users, clients, bid masters, demo)…");
  const result = spawnSync("npm", ["run", "db:seed", "-w", "@frs/db"], {
    stdio: "inherit",
    env,
    shell: true,
    cwd: root,
  });
  return result.status ?? 1;
}

try {
  const [users, clients, bidMasters] = await Promise.all([
    prisma.user.count(),
    prisma.clientMaster.count(),
    prisma.taskMaster.count({ where: { parentId: null } }),
  ]);

  console.log("[db] Current counts:", { users, clients, bidMasters });

  const needsSeed =
    users < 15 || clients < 100 || bidMasters < 100;

  if (!needsSeed) {
    console.log("[db] Seed skipped — master data already present.");
    process.exit(0);
  }

  const status = runSeed();
  if (status !== 0) process.exit(status);

  const verify = spawnSync("node", ["scripts/verify-seed.mjs"], {
    stdio: "inherit",
    env,
    cwd: root,
  });
  process.exit(verify.status ?? 1);
} catch (err) {
  console.error("[db] seed-if-needed failed:", err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
