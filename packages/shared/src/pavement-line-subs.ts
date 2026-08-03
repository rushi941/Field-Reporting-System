/** Painted pavement / symbols master bids from Bid Item List (BI-0034 … BI-0041) */
export const PAINTED_PAVEMENT_MASTER_BIDS = [
  { masterCode: "BI-0034", prefix: "MCL", name: "PAINTED PAVEMENT MARKING MULTI-COMPONENT LIQUID" },
  { masterCode: "BI-0035", prefix: "WB", name: "PAINTED PAVEMENT MARKING WATERBORNE OR SOLVENT-BASED" },
  { masterCode: "BI-0036", prefix: "DUR", name: "PAINTED PAVEMENT MARKINGS DURABLE" },
  { masterCode: "BI-0037", prefix: "HBW", name: "PAINTED PAVEMENT MARKINGS HIGH-BUILD WATERBORNE" },
  { masterCode: "BI-0038", prefix: "SLD", name: "PAINTED SYMBOLS AND LEGENDS DURABLE" },
  { masterCode: "BI-0039", prefix: "SLHB", name: "PAINTED SYMBOLS AND LEGENDS HIGH-BUILD WATERBORNE" },
  { masterCode: "BI-0040", prefix: "SLMCL", name: "PAINTED SYMBOLS AND LEGENDS MULTI-COMPONENT LIQUID" },
  { masterCode: "BI-0041", prefix: "SLWB", name: "PAINTED SYMBOLS AND LEGENDS WATERBORNE OR SOLVENT-BASED" },
] as const;

export type PavementLineSubSeed = {
  /** Base line code e.g. BCY4 */
  lineCode: string;
  name: string;
  color: string;
  widthInches: number;
  conversionFactor: number;
  unit: "LF";
  formType: "STA_RANGE";
  staBasis: "4" | "6";
};

/** 4" and 6" STA basis line catalog (unique lineCode per row) */
export const PAVEMENT_LINE_SUB_CATALOG: PavementLineSubSeed[] = [
  { lineCode: "BCY4", name: "Broken Centerline Yellow", color: "Yellow", widthInches: 4, conversionFactor: 0.25, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "DCY4", name: "Double Centerline Yellow", color: "Yellow", widthInches: 4, conversionFactor: 2.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "ELW4", name: "Edge Line Right White", color: "White", widthInches: 4, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "ELY4", name: "Edge Line Left Yellow", color: "Yellow", widthInches: 4, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "BLW4", name: "Broken Lane Line White", color: "White", widthInches: 4, conversionFactor: 0.25, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "SLW4", name: "Solid Lane Line White", color: "White", widthInches: 4, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "NPY4", name: "No Passing Zone Line Yellow", color: "Yellow", widthInches: 4, conversionFactor: 1.26, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "DLW4", name: "Dotted Line White", color: "White", widthInches: 4, conversionFactor: 0.33, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "DLY4", name: "Dotted Line Yellow", color: "Yellow", widthInches: 4, conversionFactor: 0.33, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "DDY4", name: "Double Dotted Line Yellow", color: "Yellow", widthInches: 4, conversionFactor: 0.66, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "CHW8", name: "Channelizing Line White", color: "White", widthInches: 8, conversionFactor: 2.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "CHY8", name: "Channelizing Line Yellow", color: "Yellow", widthInches: 8, conversionFactor: 2.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "LDW8", name: "Lane Drop Line White", color: "White", widthInches: 8, conversionFactor: 0.5, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "RLW4", name: "Ramp Edge Line Right White", color: "White", widthInches: 4, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "RLY4", name: "Ramp Edge Line Left Yellow", color: "Yellow", widthInches: 4, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "SLW2-4", name: "Stop Line White (4\" STA basis)", color: "White", widthInches: 24, conversionFactor: 6.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "YLW2-4", name: "Yield Line White (4\" STA basis)", color: "White", widthInches: 24, conversionFactor: 1.73, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "CLW6-4", name: "Crosswalk Line White (4\" STA basis)", color: "White", widthInches: 6, conversionFactor: 3.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "CBW6", name: "Crosswalk Bar White", color: "White", widthInches: 24, conversionFactor: 15.0, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "SPW4", name: "Sloped Curb White", color: "White", widthInches: 4, conversionFactor: 3.24, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "SPY4", name: "Sloped Curb Yellow", color: "Yellow", widthInches: 4, conversionFactor: 3.24, unit: "LF", formType: "STA_RANGE", staBasis: "4" },
  { lineCode: "BCY6", name: "Broken Centerline Yellow", color: "Yellow", widthInches: 6, conversionFactor: 0.25, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "DCY6", name: "Double Centerline Yellow", color: "Yellow", widthInches: 6, conversionFactor: 2.0, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "ELW6", name: "Edge Line Right White", color: "White", widthInches: 6, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "ELY6", name: "Edge Line Left Yellow", color: "Yellow", widthInches: 6, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "BLW6", name: "Broken Lane Line White", color: "White", widthInches: 6, conversionFactor: 0.25, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "SLW6", name: "Solid Lane Line White", color: "White", widthInches: 6, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "BLC6", name: "Broken Lane Line Black/White", color: "Blk/Wht", widthInches: 6, conversionFactor: 0.5, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "NPY6", name: "No Passing Zone Line Yellow", color: "Yellow", widthInches: 6, conversionFactor: 1.25, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "DLW6", name: "Dotted Line White", color: "White", widthInches: 6, conversionFactor: 0.33, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "DLY6", name: "Dotted Line Yellow", color: "Yellow", widthInches: 6, conversionFactor: 0.33, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "DDY6", name: "Double Dotted Line Yellow", color: "Yellow", widthInches: 6, conversionFactor: 0.67, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "CHW10", name: "Channelizing Line White", color: "White", widthInches: 10, conversionFactor: 1.67, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "CHY10", name: "Channelizing Line Yellow", color: "Yellow", widthInches: 10, conversionFactor: 1.67, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "LDW10", name: "Lane Drop Line White", color: "White", widthInches: 10, conversionFactor: 0.42, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "RLW6", name: "Ramp Edge Line Right White", color: "White", widthInches: 6, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "RLY6", name: "Ramp Edge Line Left Yellow", color: "Yellow", widthInches: 6, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "SLW2-6", name: "Stop Line White (6\" STA basis)", color: "White", widthInches: 24, conversionFactor: 4.0, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "YLW2-6", name: "Yield Line White (6\" STA basis)", color: "White", widthInches: 24, conversionFactor: 1.15, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "CLW6-6", name: "Crosswalk Line White (6\" STA basis)", color: "White", widthInches: 6, conversionFactor: 2.0, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "CBW6-6", name: "Crosswalk Bar White (6\" STA basis)", color: "White", widthInches: 24, conversionFactor: 10.0, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "SPW6", name: "Sloped Curb White", color: "White", widthInches: 6, conversionFactor: 2.28, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "SPY6", name: "Sloped Curb Yellow", color: "Yellow", widthInches: 6, conversionFactor: 2.28, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "STW6", name: "Standard Curb White", color: "White", widthInches: 6, conversionFactor: 2.03, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "STY6", name: "Standard Curb Yellow", color: "Yellow", widthInches: 6, conversionFactor: 2.03, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
  { lineCode: "MNY6", name: "Median Nose Yellow", color: "Yellow", widthInches: 6, conversionFactor: 1.0, unit: "LF", formType: "STA_RANGE", staBasis: "6" },
];

export function subBidCodeForMaster(masterPrefix: string, lineCode: string): string {
  return `${masterPrefix}-${lineCode}`.toUpperCase();
}

export type CatalogLineTypeOption = {
  id: string;
  code: string;
  name: string;
  label: string;
  conversionFactor: number;
  widthInches: number | null;
  color: string | null;
};

/** Standard PM line types for STA+CF field entry when no sub-bids exist on the master. */
export function catalogPavementLineTypes(): CatalogLineTypeOption[] {
  return PAVEMENT_LINE_SUB_CATALOG.map((line) => ({
    id: `catalog:${line.lineCode}`,
    code: line.lineCode,
    name: line.name,
    label:
      line.widthInches != null
        ? `${line.widthInches}" ${line.name}`
        : line.name,
    conversionFactor: line.conversionFactor,
    widthInches: line.widthInches,
    color: line.color,
  }));
}
