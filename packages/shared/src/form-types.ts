import { z } from "zod";

/** Four explicit bid-item form types — drives field UI routing. */
export const bidItemFormTypeEnum = z.enum([
  "STA_WITH_CF",
  "STA_NO_CF",
  "SINGLE_POINT",
  "QUANTITY_ONLY",
]);

export type BidItemFormType = z.infer<typeof bidItemFormTypeEnum>;

/** Legacy DB/API values mapped to the four-type model. */
export function normalizeFormType(formType: string): BidItemFormType {
  switch (formType) {
    case "STA_WITH_CF":
    case "STA_NO_CF":
    case "SINGLE_POINT":
    case "QUANTITY_ONLY":
      return formType;
    case "STA_RANGE":
      return "STA_WITH_CF";
    case "SINGLE_LOCATION":
      return "SINGLE_POINT";
    default:
      return "SINGLE_POINT";
  }
}

export function coerceFormType(val: unknown): BidItemFormType {
  if (typeof val !== "string" || !val.trim()) return "STA_WITH_CF";
  return normalizeFormType(val.trim());
}

/** Accepts current values and legacy STA_RANGE / SINGLE_LOCATION. Never enum-rejects input. */
export const formTypeInputSchema = z.unknown().transform((val) => coerceFormType(val));

export const optionalFormTypeInputSchema = z.unknown().transform((val) => {
  if (val === undefined || val === null || val === "") return undefined;
  return coerceFormType(val);
});

export function isStaWithCf(formType: string): boolean {
  return normalizeFormType(formType) === "STA_WITH_CF";
}

export function isStaNoCf(formType: string): boolean {
  return normalizeFormType(formType) === "STA_NO_CF";
}

export function isStaFormType(formType: string): boolean {
  const n = normalizeFormType(formType);
  return n === "STA_WITH_CF" || n === "STA_NO_CF";
}

export function isSinglePointFormType(formType: string): boolean {
  return normalizeFormType(formType) === "SINGLE_POINT";
}

export function isQuantityOnlyFormType(formType: string): boolean {
  return normalizeFormType(formType) === "QUANTITY_ONLY";
}

export function allowsManualLf(formType: string): boolean {
  return isStaNoCf(formType) || isStaWithCf(formType);
}

export const FORM_TYPE_LABELS: Record<BidItemFormType, string> = {
  STA_WITH_CF: "STA + CF",
  STA_NO_CF: "STA range",
  SINGLE_POINT: "Single point",
  QUANTITY_ONLY: "Quantity only",
};

export function formTypeLabel(formType: string): string {
  return FORM_TYPE_LABELS[normalizeFormType(formType)] ?? formType;
}

/** Infer form type from unit (+ optional division) when importing bids. */
export function inferFormType(input: {
  unit: string;
  division?: string | null;
}): BidItemFormType {
  const u = input.unit.trim().toUpperCase();
  if (u === "LS" || u === "CDAY" || u === "DAY" || u === "MO") {
    return "QUANTITY_ONLY";
  }
  if (u === "STA" || u === "LF") {
    if (input.division === "PAVEMENT_MARKING" && u === "STA") {
      return "STA_WITH_CF";
    }
    if (u === "LF") return "STA_NO_CF";
    return "STA_WITH_CF";
  }
  return "SINGLE_POINT";
}

export const lineSideEnum = z.enum(["L", "R"]);
export type LineSide = z.infer<typeof lineSideEnum>;
