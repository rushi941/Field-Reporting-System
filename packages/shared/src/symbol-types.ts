/** Standard pavement symbol types for field entry (Painted Symbols & Legends). */
export const SYMBOL_TYPE_CATALOG = [
  { code: "LTA", name: "Left Turn Arrow" },
  { code: "RTA", name: "Right Turn Arrow" },
  { code: "STR", name: "Straight Arrow" },
  { code: "LTA-STR", name: "Combo LTA/Straight" },
  { code: "RTA-STR", name: "Combo RTA/Straight" },
  { code: "ONLY", name: "ONLY" },
  { code: "RR", name: "RR Crossing" },
  { code: "YIELD", name: "Yield Marks" },
  { code: "SCHOOL", name: "School X-ing" },
  { code: "HC", name: "Handicap Symbol" },
  { code: "BIKE", name: "Bicycle Symbol" },
  { code: "OTHER", name: "Other" },
] as const;

export type SymbolTypeSeed = (typeof SYMBOL_TYPE_CATALOG)[number];

export function formatSymbolTypeLabel(code: string, name: string): string {
  return `${code} — ${name}`;
}

/** Master bids that use symbol-row entry (station + symbol type + qty). */
export function isSymbolsAndLegendsMaster(code: string, name: string): boolean {
  const upper = name.toUpperCase();
  if (upper.includes("SYMBOLS AND LEGENDS") || upper.includes("SYMBOLS & LEGENDS")) {
    return true;
  }
  return /^BI-003[89]|^BI-004[01]/.test(code.toUpperCase());
}

/** Field entry uses symbol rows for PM symbols/signs and permanent-sign EA tasks. */
export function usesSymbolEntryLayout(input: {
  formType: string;
  division: string;
  unit: string;
  masterCode: string;
  masterName: string;
  symbolTypeCount?: number;
}): boolean {
  if (input.formType !== "SINGLE_LOCATION") return false;
  if (isSymbolsAndLegendsMaster(input.masterCode, input.masterName)) return true;
  if (input.division === "PERMANENT_SIGNS" && input.unit.toUpperCase() === "EA") {
    return true;
  }
  return (input.symbolTypeCount ?? 0) > 0;
}

export function defaultSymbolTypes(): {
  code: string;
  name: string;
  label: string;
}[] {
  return SYMBOL_TYPE_CATALOG.map((s) => ({
    code: s.code,
    name: s.name,
    label: formatSymbolTypeLabel(s.code, s.name),
  }));
}

/** Match stored line-item symbol text back to a catalog code. */
export function matchSymbolTypeCode(
  stored: string | null | undefined,
  catalog = defaultSymbolTypes(),
): string {
  if (!stored?.trim()) return catalog[0]?.code ?? "OTHER";
  const trimmed = stored.trim();
  const byLabel = catalog.find(
    (s) => s.label.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byLabel) return byLabel.code;
  const byCode = catalog.find(
    (s) => s.code.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byCode) return byCode.code;
  const byName = catalog.find(
    (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byName) return byName.code;
  const prefix = trimmed.split(/[\s—–-]/)[0]?.trim();
  if (prefix) {
    const byPrefix = catalog.find(
      (s) => s.code.toLowerCase() === prefix.toLowerCase(),
    );
    if (byPrefix) return byPrefix.code;
  }
  return catalog.some((s) => s.code === "OTHER") ? "OTHER" : (catalog[0]?.code ?? "");
}

export function symbolTypeLabelForCode(
  code: string,
  catalog = defaultSymbolTypes(),
): string {
  const hit = catalog.find((s) => s.code === code);
  return hit?.label ?? code;
}
