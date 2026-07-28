import { z } from "zod";

export const clientMasterSchema = z.object({
  foundationNumber: z.number().int().positive().optional().nullable(),
  name: z.string().min(1).max(200),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const updateClientMasterSchema = clientMasterSchema.partial();

export type ClientMasterInput = z.infer<typeof clientMasterSchema>;

export const CLIENT_IMPORT_HEADERS = ["Foundation #", "Name"] as const;

export const CLIENT_IMPORT_SAMPLE_ROWS: readonly (readonly string[])[] = [
  ["1", "Absolute Concrete Inc"],
  ["2", "Advanced Traffic Control"],
];

export const clientImportRowSchema = z.object({
  foundationNumber: z.number().int().positive().optional().nullable(),
  name: z.string().min(1).max(200),
});

export type ClientImportRow = z.infer<typeof clientImportRowSchema>;

function pickField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const hit = Object.entries(row).find(
      ([k]) => k.trim().toLowerCase() === key.toLowerCase(),
    );
    if (hit && String(hit[1] ?? "").trim() !== "") return hit[1];
  }
  return undefined;
}

export function normalizeClientImportRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const foundationRaw = pickField(row, [
    "foundation #",
    "foundationnumber",
    "foundation_number",
    "foundation",
    "number",
    "#",
  ]);
  const nameRaw = pickField(row, ["name", "client", "client name", "customer"]);

  let foundationNumber: number | null = null;
  if (foundationRaw != null && String(foundationRaw).trim() !== "") {
    const n = Number(String(foundationRaw).replace(/,/g, "").trim());
    if (Number.isFinite(n) && n > 0) foundationNumber = Math.trunc(n);
  }

  return {
    foundationNumber,
    name: String(nameRaw ?? "").trim(),
  };
}
