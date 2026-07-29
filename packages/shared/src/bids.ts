import { z } from "zod";
import { divisionEnum } from "./projects.js";

export const BID_IMPORT_HEADERS = [
  "Item Reference #",
  "Description",
  "Unit",
  "Division",
] as const;

export const BID_IMPORT_SAMPLE_ROWS: readonly (readonly string[])[] = [
  ["1", "AIRPORT PAVEMENT MARKINGS REMOVED", "SF", "Miscellaneous"],
  ["2", "CONCRETE BARRIER RAIL BA-107", "EA", "Miscellaneous"],
];

const BID_DIVISION_LABELS: Record<string, z.infer<typeof divisionEnum>> = {
  "pavement marking": "PAVEMENT_MARKING",
  pavement_marking: "PAVEMENT_MARKING",
  pavementmarking: "PAVEMENT_MARKING",
  "traffic control": "TRAFFIC_CONTROL",
  traffic_control: "TRAFFIC_CONTROL",
  trafficcontrol: "TRAFFIC_CONTROL",
  "permanent signing": "PERMANENT_SIGNS",
  "permanent signs": "PERMANENT_SIGNS",
  permanent_signing: "PERMANENT_SIGNS",
  permanent_signs: "PERMANENT_SIGNS",
  permanentsigning: "PERMANENT_SIGNS",
  permanentsigns: "PERMANENT_SIGNS",
  miscellaneous: "MISCELLANEOUS",
  misc: "MISCELLANEOUS",
};

const BID_PROJECT_TYPE_BY_DIVISION: Record<
  z.infer<typeof divisionEnum>,
  string
> = {
  PAVEMENT_MARKING: "PM",
  TRAFFIC_CONTROL: "TC",
  PERMANENT_SIGNS: "PS",
  MISCELLANEOUS: "COMBINED",
};

export function mapBidDivisionLabel(
  label: string,
): z.infer<typeof divisionEnum> | null {
  const key = label.trim().toLowerCase().replace(/\s+/g, " ");
  if (BID_DIVISION_LABELS[key]) return BID_DIVISION_LABELS[key];
  const compact = key.replace(/[\s_]+/g, "");
  return BID_DIVISION_LABELS[compact] ?? null;
}

export function inferBidFormType(unit: string): "STA_RANGE" | "SINGLE_LOCATION" {
  const u = unit.trim().toUpperCase();
  return u === "STA" || u === "LF" ? "STA_RANGE" : "SINGLE_LOCATION";
}

export function bidCodeFromReference(ref: string | number): string {
  const n = String(ref).replace(/\D/g, "").trim();
  return `BI-${(n || "0").padStart(4, "0")}`;
}

function normalizeSpreadsheetKey(key: string): string {
  return key.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function pickField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const hit = Object.entries(row).find(
      ([k]) => normalizeSpreadsheetKey(k) === key.toLowerCase(),
    );
    if (hit && String(hit[1] ?? "").trim() !== "") return hit[1];
  }
  return undefined;
}

export function normalizeBidImportRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const refRaw = pickField(row, [
    "item reference #",
    "item reference",
    "reference #",
    "reference",
    "code",
    "item #",
    "#",
  ]);
  const nameRaw = pickField(row, [
    "description",
    "name",
    "generic name",
    "bid item",
  ]);
  const unitRaw = pickField(row, ["unit", "uom"]);
  const divisionRaw = pickField(row, ["division", "div"]);

  const name = String(nameRaw ?? "").trim();
  const unit = String(unitRaw ?? "EA")
    .trim()
    .toUpperCase();
  const division = divisionRaw
    ? mapBidDivisionLabel(String(divisionRaw))
    : null;
  const code = refRaw
    ? bidCodeFromReference(String(refRaw))
    : name
      ? bidCodeFromName(name)
      : "";

  return {
    code,
    name,
    unit,
    division,
    formType: inferBidFormType(unit),
    projectTypeCode: division ? BID_PROJECT_TYPE_BY_DIVISION[division] : null,
    description: name,
    sortOrder: Number(String(refRaw ?? "").replace(/\D/g, "")) || undefined,
  };
}

function bidCodeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const bidImportRowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  formType: z.enum(["STA_RANGE", "SINGLE_LOCATION"]).optional(),
  projectTypeCode: z.string().optional().nullable(),
  division: divisionEnum.optional().nullable(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export type BidImportRow = z.infer<typeof bidImportRowSchema>;

export type BidSeedRow = BidImportRow & { sortOrder: number };
