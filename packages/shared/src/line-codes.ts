/**
 * Pavement marking line codes + conversion factors (US striping).
 *
 * Code format: XX C ##
 *   XX = line type (BC, DC, EL, …)
 *   C  = color (W=White, Y=Yellow, C=Black/White)
 *   ## = width inches (4 | 6 | 10 | 24)
 *
 * Reported LF = (End STA − Begin STA) × 100 × CF
 * Physical LF = (End STA − Begin STA) × 100
 *
 * Width-equivalent CF (solid / channelizing style):
 *   CF = (lineWidth ÷ basisWidth) × patternFactor
 * Default catalog CF uses 4" billing basis unless overridden.
 */

export const LINE_WIDTHS = [4, 6, 10, 24] as const;
export type LineWidth = (typeof LINE_WIDTHS)[number];

export const LINE_COLORS = {
  W: "White",
  Y: "Yellow",
  C: "Blk/Wht",
} as const;
export type LineColorCode = keyof typeof LINE_COLORS;

export type CfMode =
  /** Pattern factor only (same CF at every width) */
  | "pattern"
  /** CF = (width / basisInches) * patternFactor — 4" equivalent billing */
  | "equiv";

export type LineTypeDef = {
  /** Two-letter type prefix */
  prefix: string;
  /** Master / family name */
  name: string;
  color: LineColorCode;
  mode: CfMode;
  /** Pattern multiplier (solid=1, double=2, broken=0.25, …) */
  patternFactor: number;
  /** Billing basis inches for equiv mode (default 4) */
  basisInches?: number;
  /** Explicit CF overrides by width (from client sheets) */
  cfByWidth?: Partial<Record<LineWidth, number>>;
  /** Which widths to generate */
  widths: LineWidth[];
  formType?: "STA_RANGE" | "SINGLE_LOCATION";
  sortOrder: number;
};

/** Round CF for storage / display */
export function roundCf(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Build line code: XX + C + width  e.g. DCY4, ELW6 */
export function buildLineCode(
  typePrefix: string,
  color: LineColorCode,
  widthInches: number,
): string {
  return `${typePrefix.toUpperCase()}${color}${widthInches}`;
}

/** Parse XXC## → parts (returns null if invalid) */
export function parseLineCode(code: string): {
  prefix: string;
  color: LineColorCode;
  widthInches: number;
} | null {
  const m = /^([A-Z]{2})([WYC])(\d{1,2})$/i.exec(code.trim());
  if (!m) return null;
  const color = m[2].toUpperCase() as LineColorCode;
  if (!(color in LINE_COLORS)) return null;
  return {
    prefix: m[1].toUpperCase(),
    color,
    widthInches: Number(m[3]),
  };
}

/**
 * Conversion factor for a line type at a given width.
 * Prefer explicit sheet values; else apply pattern / width-equivalent formula.
 */
export function conversionFactorFor(
  def: Pick<LineTypeDef, "mode" | "patternFactor" | "basisInches" | "cfByWidth">,
  widthInches: number,
): number {
  const w = widthInches as LineWidth;
  if (def.cfByWidth?.[w] != null) return roundCf(def.cfByWidth[w]!);
  if (def.mode === "pattern") return roundCf(def.patternFactor);
  const basis = def.basisInches ?? 4;
  return roundCf((widthInches / basis) * def.patternFactor);
}

/** Physical LF from STA range */
export function physicalLf(beginSta: number, endSta: number): number {
  return (endSta - beginSta) * 100;
}

/** Reported LF = (End STA − Begin STA) × 100 × CF */
export function reportedLf(
  beginSta: number,
  endSta: number,
  conversionFactor: number,
): number {
  return physicalLf(beginSta, endSta) * conversionFactor;
}

/**
 * When a coded line width differs from the contract / bid basis width
 * (sheet example: ELW4 on 6" contract → CF 0.67).
 * CF = (lineWidth / basisWidth) × patternFactor
 */
export function conversionFactorVsBasis(
  lineWidthInches: number,
  basisWidthInches: number,
  patternFactor = 1,
): number {
  if (basisWidthInches <= 0) return 0;
  return roundCf((lineWidthInches / basisWidthInches) * patternFactor);
}

/** Client line-type catalog (pavement marking) */
export const pavementLineTypes: LineTypeDef[] = [
  {
    prefix: "BC",
    name: "Broken Centerline",
    color: "Y",
    mode: "pattern",
    patternFactor: 0.25,
    widths: [4, 6, 10, 24],
    sortOrder: 10,
  },
  {
    prefix: "DC",
    name: "Double Centerline",
    color: "Y",
    mode: "pattern",
    patternFactor: 2,
    widths: [4, 6, 10, 24],
    sortOrder: 20,
  },
  {
    prefix: "EL",
    name: "Edge Line Right",
    color: "W",
    mode: "pattern",
    patternFactor: 1,
    widths: [4, 6, 10, 24],
    sortOrder: 30,
  },
  {
    prefix: "EL",
    name: "Edge Line Left",
    color: "Y",
    mode: "pattern",
    patternFactor: 1,
    widths: [4, 6, 10, 24],
    sortOrder: 40,
  },
  {
    prefix: "BL",
    name: "Broken Lane Line",
    color: "W",
    mode: "pattern",
    patternFactor: 0.25,
    widths: [4, 6, 10, 24],
    sortOrder: 50,
  },
  {
    prefix: "SL",
    name: "Solid Lane Line",
    color: "W",
    mode: "pattern",
    patternFactor: 1,
    widths: [4, 6, 10, 24],
    sortOrder: 60,
  },
  {
    prefix: "BL",
    name: "Broken Lane Line",
    color: "C",
    mode: "pattern",
    patternFactor: 0.5,
    cfByWidth: { 6: 0.5 },
    widths: [4, 6, 10, 24],
    sortOrder: 70,
  },
  {
    prefix: "NP",
    name: "No Passing Zone Line",
    color: "Y",
    mode: "pattern",
    patternFactor: 1.26,
    cfByWidth: { 4: 1.26, 6: 1.25 },
    widths: [4, 6, 10, 24],
    sortOrder: 80,
  },
  {
    prefix: "DL",
    name: "Dotted Line",
    color: "W",
    mode: "pattern",
    patternFactor: 0.33,
    widths: [4, 6, 10, 24],
    sortOrder: 90,
  },
  {
    prefix: "DL",
    name: "Dotted Line",
    color: "Y",
    mode: "pattern",
    patternFactor: 0.33,
    widths: [4, 6, 10, 24],
    sortOrder: 100,
  },
  {
    prefix: "DD",
    name: "Double Dotted Line",
    color: "Y",
    mode: "pattern",
    patternFactor: 0.66,
    cfByWidth: { 4: 0.66, 6: 0.67 },
    widths: [4, 6, 10, 24],
    sortOrder: 110,
  },
  // Wide lines — CF = width/4 (4" equivalent) × pattern
  {
    prefix: "CH",
    name: "Channelizing Line",
    color: "W",
    mode: "equiv",
    patternFactor: 1,
    basisInches: 4,
    // Sheet also showed 10" on 6" basis → 1.67; store known override optional
    cfByWidth: { 10: 1.67 },
    widths: [4, 6, 10, 24],
    sortOrder: 120,
  },
  {
    prefix: "CH",
    name: "Channelizing Line",
    color: "Y",
    mode: "equiv",
    patternFactor: 1,
    basisInches: 4,
    cfByWidth: { 10: 1.67 },
    widths: [4, 6, 10, 24],
    sortOrder: 130,
  },
  {
    prefix: "LD",
    name: "Lane Drop Line",
    color: "W",
    mode: "equiv",
    patternFactor: 0.25,
    basisInches: 4,
    cfByWidth: { 10: 0.42 },
    widths: [4, 6, 10, 24],
    sortOrder: 140,
  },
  {
    prefix: "RL",
    name: "Ramp Edge Line Right",
    color: "W",
    mode: "pattern",
    patternFactor: 1,
    widths: [4, 6, 10, 24],
    sortOrder: 150,
  },
  {
    prefix: "RL",
    name: "Ramp Edge Line Left",
    color: "Y",
    mode: "pattern",
    patternFactor: 1,
    widths: [4, 6, 10, 24],
    sortOrder: 160,
  },
  {
    prefix: "ST",
    name: "Stop Line",
    color: "W",
    mode: "equiv",
    patternFactor: 1,
    basisInches: 4,
    cfByWidth: { 24: 6 },
    widths: [4, 6, 10, 24],
    formType: "STA_RANGE",
    sortOrder: 170,
  },
  {
    prefix: "YL",
    name: "Yield Line",
    color: "W",
    mode: "pattern",
    patternFactor: 1.73,
    cfByWidth: { 24: 1.73, 6: 1.15 },
    widths: [4, 6, 10, 24],
    sortOrder: 180,
  },
  {
    prefix: "CL",
    name: "Crosswalk Line",
    color: "W",
    mode: "pattern",
    patternFactor: 3,
    cfByWidth: { 6: 3, 4: 3 },
    // On 6" sheet CF was 2.00 for 6" — keep primary sheet (4" basis) as 3.00 for 6"
    widths: [4, 6, 10, 24],
    sortOrder: 190,
  },
  {
    prefix: "CB",
    name: "Crosswalk Bar",
    color: "W",
    mode: "equiv",
    patternFactor: 2.5,
    basisInches: 4,
    cfByWidth: { 24: 15 },
    widths: [4, 6, 10, 24],
    sortOrder: 200,
  },
  {
    prefix: "SP",
    name: "Sloped Curb",
    color: "W",
    mode: "pattern",
    patternFactor: 3.24,
    cfByWidth: { 4: 3.24, 6: 2.28 },
    widths: [4, 6, 10, 24],
    sortOrder: 210,
  },
  {
    prefix: "SP",
    name: "Sloped Curb",
    color: "Y",
    mode: "pattern",
    patternFactor: 3.24,
    cfByWidth: { 4: 3.24, 6: 2.28 },
    widths: [4, 6, 10, 24],
    sortOrder: 220,
  },
  {
    prefix: "SC",
    name: "Standard Curb",
    color: "W",
    mode: "pattern",
    patternFactor: 2.03,
    cfByWidth: { 6: 2.03 },
    widths: [4, 6, 10, 24],
    sortOrder: 230,
  },
  {
    prefix: "SC",
    name: "Standard Curb",
    color: "Y",
    mode: "pattern",
    patternFactor: 2.03,
    cfByWidth: { 6: 2.03 },
    widths: [4, 6, 10, 24],
    sortOrder: 240,
  },
  {
    prefix: "MN",
    name: "Median Nose",
    color: "Y",
    mode: "pattern",
    patternFactor: 1,
    cfByWidth: { 6: 1 },
    widths: [4, 6, 10, 24],
    sortOrder: 250,
  },
];

export type GeneratedLineBid = {
  /** Master family code e.g. PM-BC-Y */
  masterCode: string;
  masterName: string;
  code: string;
  name: string;
  description: string;
  unit: "LF";
  formType: "STA_RANGE" | "SINGLE_LOCATION";
  projectTypeCode: "PM";
  division: "PAVEMENT_MARKING";
  parentCode: string;
  color: string;
  colorCode: LineColorCode;
  widthInches: number;
  conversionFactor: number;
  sortOrder: number;
};

/** Expand line types → master families + width sub-bids with auto codes + CF */
export function buildPavementMarkingBidCatalog(): {
  masters: {
    code: string;
    name: string;
    description: string;
    unit: "LF";
    formType: "STA_RANGE" | "SINGLE_LOCATION";
    projectTypeCode: "PM";
    division: "PAVEMENT_MARKING";
    sortOrder: number;
  }[];
  subs: GeneratedLineBid[];
} {
  const masters: {
    code: string;
    name: string;
    description: string;
    unit: "LF";
    formType: "STA_RANGE" | "SINGLE_LOCATION";
    projectTypeCode: "PM";
    division: "PAVEMENT_MARKING";
    sortOrder: number;
  }[] = [];
  const subs: GeneratedLineBid[] = [];
  const seenMaster = new Set<string>();

  for (const def of pavementLineTypes) {
    const masterCode = `PM-${def.prefix}-${def.color}`;
    const colorLabel = LINE_COLORS[def.color];
    const masterName = `${def.name} (${colorLabel})`;

    if (!seenMaster.has(masterCode)) {
      seenMaster.add(masterCode);
      masters.push({
        code: masterCode,
        name: masterName,
        description: `Master bid — ${def.name}, color ${colorLabel}. Sub-bids are width variants with auto line codes.`,
        unit: "LF",
        formType: def.formType ?? "STA_RANGE",
        projectTypeCode: "PM",
        division: "PAVEMENT_MARKING",
        sortOrder: def.sortOrder,
      });
    }

    for (const width of def.widths) {
      const code = buildLineCode(def.prefix, def.color, width);
      const cf = conversionFactorFor(def, width);
      subs.push({
        masterCode,
        masterName,
        code,
        name: `${def.name} ${colorLabel} ${width}"`,
        description: `Line code ${code}. CF ${cf.toFixed(2)}. Reported LF = (End STA − Begin STA) × 100 × ${cf.toFixed(2)}.`,
        unit: "LF",
        formType: def.formType ?? "STA_RANGE",
        projectTypeCode: "PM",
        division: "PAVEMENT_MARKING",
        parentCode: masterCode,
        color: colorLabel,
        colorCode: def.color,
        widthInches: width,
        conversionFactor: cf,
        sortOrder: def.sortOrder * 100 + width,
      });
    }
  }

  return { masters, subs };
}
