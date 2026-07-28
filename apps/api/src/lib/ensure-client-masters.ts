import { prisma, type Prisma } from "@frs/db";

function normalizeClientName(name: string | null | undefined): string | null {
  if (name == null) return null;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Create ClientMaster rows for names not already in the catalog (case-insensitive). */
export async function ensureClientMasters(
  names: (string | null | undefined)[],
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const raw of names) {
    const name = normalizeClientName(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }

  for (const name of unique) {
    const existing = await db.clientMaster.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) continue;

    await db.clientMaster.create({
      data: {
        name,
        isActive: true,
        sortOrder: 0,
      },
    });
  }
}
