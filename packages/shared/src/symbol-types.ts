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

/** BI-0034 … BI-0037 — area markings counted by location, not STA span. */
export function isPaintedPavementMarkingMaster(code: string, name: string): boolean {
  if (/^BI-003[4-7]$/.test(code.trim().toUpperCase())) return true;
  const upper = name.toUpperCase();
  return (
    upper.includes("PAINTED PAVEMENT MARKING") &&
    !upper.includes("SYMBOLS") &&
    !upper.includes("LEGENDS")
  );
}

/** Admin Add task — only STA-range line work needs Begin/End STA. */
export function adminNeedsStaWorkLimits(input: {
  formType: string;
  masterCode: string;
  masterName: string;
}): boolean {
  if (input.formType !== "STA_RANGE") return false;
  return !isPaintedPavementMarkingMaster(input.masterCode, input.masterName);
}

export type AdminFieldEntryPreview = {
  title: string;
  description: string;
  fields: readonly string[];
};

/** What the field lead enters when admin does not set STA limits. */
export function adminFieldEntryPreview(input: {
  formType: string;
  division: string;
  unit: string;
  masterCode: string;
  masterName: string;
}): AdminFieldEntryPreview | null {
  const useSta = adminNeedsStaWorkLimits(input);
  if (useSta) return null;

  const unit = input.unit.trim().toUpperCase() || "EA";

  if (
    input.formType === "SINGLE_LOCATION" &&
    usesSymbolEntryLayout({ ...input, symbolTypeCount: 1 })
  ) {
    return {
      title: "Field entry",
      description:
        "No station limits here — the field lead adds a row for each symbol or sign.",
      fields: ["Station / location", "Symbol or sign type", `Quantity (${unit})`],
    };
  }

  if (isPaintedPavementMarkingMaster(input.masterCode, input.masterName)) {
    return {
      title: "Field entry",
      description:
        "Marked areas are counted by location — no Begin/End STA on this bid.",
      fields: ["Station / location", `Area quantity (${unit})`],
    };
  }

  if (isLocationOnlyFieldEntry(input)) {
    return {
      title: "Field entry",
      description:
        "Add a row for each location — no Begin/End STA on this bid.",
      fields: ["Station / location", `Quantity (${unit})`],
    };
  }

  if (input.formType !== "SINGLE_LOCATION") return null;

  return {
    title: "Field entry",
    description:
      "Quantities are entered at each location in the field app — no Begin/End STA.",
    fields: ["Station / location", "Item or description", `Quantity (${unit})`],
  };
}

/** Master bids that use symbol-row entry (station + symbol type + qty). */
export function isSymbolsAndLegendsMaster(code: string, name: string): boolean {
  const upper = name.toUpperCase();
  if (upper.includes("SYMBOLS AND LEGENDS") || upper.includes("SYMBOLS & LEGENDS")) {
    return true;
  }
  return /^BI-003[89]|^BI-004[01]/.test(code.toUpperCase());
}

export function isRaisedPavementMarkersMaster(code: string, name: string): boolean {
  if (/^BI-0065$/i.test(code.trim())) return true;
  return name.toUpperCase().includes("RAISED PAVEMENT MARKER");
}

export function isPreCutSymbolsMaster(code: string, name: string): boolean {
  if (/^BI-0063$/i.test(code.trim())) return true;
  return name.toUpperCase().includes("PRE-CUT SYMBOLS");
}

/** Station + qty only — no symbol/line picker (RPM, signs, painted area SF, etc.). */
export function isLocationOnlyFieldEntry(input: {
  formType: string;
  division: string;
  masterCode: string;
  masterName: string;
}): boolean {
  if (input.formType !== "SINGLE_LOCATION") return false;
  if (isPaintedPavementMarkingMaster(input.masterCode, input.masterName)) {
    return true;
  }
  if (isRaisedPavementMarkersMaster(input.masterCode, input.masterName)) {
    return true;
  }
  if (input.division === "PERMANENT_SIGNS") return true;
  return false;
}

/** Field entry uses symbol rows (station + symbol type + qty). */
export function usesSymbolEntryLayout(input: {
  formType: string;
  division: string;
  unit: string;
  masterCode: string;
  masterName: string;
  symbolTypeCount?: number;
}): boolean {
  if (input.formType !== "SINGLE_LOCATION") return false;
  if (isLocationOnlyFieldEntry(input)) return false;
  if (isSymbolsAndLegendsMaster(input.masterCode, input.masterName)) return true;
  if (isPreCutSymbolsMaster(input.masterCode, input.masterName)) return true;
  return false;
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
