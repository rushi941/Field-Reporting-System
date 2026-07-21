/**
 * Normalize Neon / Postgres URLs for Prisma on Render.
 * - Ensures sslmode=require (required for Neon)
 * - For migrations: strips "-pooler" (Neon direct host) — DDL fails on pooler
 */

export function normalizeDatabaseUrl(raw, { forMigrate = false } = {}) {
  if (!raw?.trim()) return null;

  let url = raw.trim();

  if (forMigrate && url.includes("-pooler")) {
    url = url.replace("-pooler", "");
    console.log(
      "[db] Migration uses Neon direct connection (removed -pooler from host).",
    );
  }

  if (!/[?&]sslmode=/.test(url)) {
    url += `${url.includes("?") ? "&" : "?"}sslmode=require`;
  }

  return url;
}

export function migrateEnv(baseEnv = process.env) {
  const url = normalizeDatabaseUrl(baseEnv.DATABASE_URL, { forMigrate: true });
  return { ...baseEnv, DATABASE_URL: url ?? baseEnv.DATABASE_URL };
}
