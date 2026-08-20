/**
 * Station (STA) normalize + parse (FR-FLD-005).
 * Accepts `142+50` and `142.50`; stores/display as plus-sign form.
 */

import { isStaFormType } from "./form-types.js";

export function normalizeSta(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error("Station is required");

  const plus = /^(\d+)\+(\d{1,2})$/.exec(raw);
  if (plus) {
    const feet = plus[2].padStart(2, "0");
    return `${Number(plus[1])}+${feet}`;
  }

  const decimal = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (decimal) {
    const miles = Number(decimal[1]);
    const feetPart = (decimal[2] ?? "0").padEnd(2, "0").slice(0, 2);
    return `${miles}+${feetPart}`;
  }

  throw new Error("Use station format like 142+50 or 142.50");
}

/** Station string → decimal miles (e.g. 142+50 → 142.50) */
export function parseStaToDecimal(sta: string): number {
  const normalized = normalizeSta(sta);
  const [miles, feet] = normalized.split("+").map(Number);
  return miles + feet / 100;
}

/** Decimal station span (e.g. 1+00 → 4+00 = 3.00) */
export function stationSpanDecimal(beginSta: string, endSta: string): number {
  return Math.abs(parseStaToDecimal(endSta) - parseStaToDecimal(beginSta));
}

/** Physical LF from Begin/End STA — always (End − Begin), never End alone */
export function physicalLfFromSta(beginSta: string, endSta: string): number {
  const begin = normalizeSta(beginSta);
  const end = normalizeSta(endSta);
  const [bMile, bFeet] = begin.split("+").map(Number);
  const [eMile, eFeet] = end.split("+").map(Number);
  const spanFeet = Math.abs((eMile - bMile) * 100 + (eFeet - bFeet));
  if (spanFeet <= 0) {
    throw new Error("End STA must be after Begin STA");
  }
  return spanFeet;
}

/** Canonical decimal bounds for a STA range (direction-independent). */
export function canonicalStaDecimals(
  beginSta: string,
  endSta: string,
): { lo: number; hi: number } {
  const a = parseStaToDecimal(beginSta);
  const b = parseStaToDecimal(endSta);
  return { lo: Math.min(a, b), hi: Math.max(a, b) };
}

/** True when two STA ranges share any station (touching endpoints are OK). */
export function staRangesOverlap(
  aBegin: string,
  aEnd: string,
  bBegin: string,
  bEnd: string,
): boolean {
  const a = canonicalStaDecimals(aBegin, aEnd);
  const b = canonicalStaDecimals(bBegin, bEnd);
  return b.lo < a.hi && a.lo < b.hi;
}

/** Total non-overlapping STA span across ranges (decimal stations, e.g. 1+00→4+00 = 3). */
export function unionStaSpanDecimal(
  ranges: { beginSta: string; endSta: string }[],
): number {
  const intervals = ranges
    .map((r) => canonicalStaDecimals(r.beginSta, r.endSta))
    .filter((i) => i.hi > i.lo)
    .sort((a, b) => a.lo - b.lo);
  if (!intervals.length) return 0;

  let total = 0;
  let curLo = intervals[0]!.lo;
  let curHi = intervals[0]!.hi;

  for (let i = 1; i < intervals.length; i++) {
    const { lo, hi } = intervals[i]!;
    if (lo <= curHi) {
      curHi = Math.max(curHi, hi);
    } else {
      total += curHi - curLo;
      curLo = lo;
      curHi = hi;
    }
  }
  total += curHi - curLo;
  return total;
}

/**
 * Reported STA = (End STA − Begin STA) × conversion factor.
 * Example: 1525+50 → 1680+60, CF 0.25 → 155.10 × 0.25 = 38.775 STA.
 */
export function reportedStaFromRange(
  beginSta: string,
  endSta: string,
  conversionFactor = 1,
): number {
  const cf = conversionFactor > 0 ? conversionFactor : 1;
  return stationSpanDecimal(beginSta, endSta) * cf;
}

/** Billable quantity from merged STA coverage (no double-count on overlaps). */
export function quantityFromUnionStaRanges(
  _unit: string,
  ranges: { beginSta: string; endSta: string }[],
  conversionFactor = 1,
): number {
  const spanSta = unionStaSpanDecimal(ranges);
  if (spanSta <= 0) return 0;
  const cf = conversionFactor > 0 ? conversionFactor : 1;
  return spanSta * cf;
}

/** Billable quantity from a STA range: (End − Begin) × CF, reported in STA. */
export function quantityFromStaRange(
  _unit: string,
  beginSta: string,
  endSta: string,
  conversionFactor = 1,
): number {
  return reportedStaFromRange(beginSta, endSta, conversionFactor);
}

/** STA-range field work is billed in STA: (End − Begin) × CF. */
export function staBillingUnit(
  masterUnit?: string,
  lineTypeCode?: string | null,
): string {
  if (lineTypeCode?.trim()) return "STA";
  const u = (masterUnit ?? "STA").trim().toUpperCase();
  if (u === "LF" || u === "SF" || u === "STA") return "STA";
  return masterUnit ?? "STA";
}

/** Display unit for grouped STA line items. */
export function staBillingUnitForEntries(
  masterUnit?: string,
  entries: { lineTypeCode?: string | null }[] = [],
): string {
  if (entries.some((e) => e.lineTypeCode?.trim())) return "STA";
  return staBillingUnit(masterUnit);
}

/** Task progress estimate from work limits or reported totals. */
export function estimateTaskQuantity(input: {
  unit: string;
  formType: string;
  conversionFactor?: number | null;
  estimatedQuantity?: number | null;
  beginSta?: string | null;
  endSta?: string | null;
  routeBeginSta?: string | null;
  routeEndSta?: string | null;
  reportedApproved?: number;
  reportedPending?: number;
}): number {
  const explicit =
    input.estimatedQuantity != null ? Number(input.estimatedQuantity) : null;
  if (explicit != null && !Number.isNaN(explicit) && explicit > 0) {
    return explicit;
  }

  const begin = input.beginSta?.trim() || input.routeBeginSta?.trim();
  const end = input.endSta?.trim() || input.routeEndSta?.trim();

  if (isStaFormType(input.formType) && begin && end) {
    try {
      const cf = Number(input.conversionFactor ?? 1);
      return quantityFromStaRange(input.unit, begin, end, cf);
    } catch {
      /* fall through */
    }
  }

  const floor = (input.reportedApproved ?? 0) + (input.reportedPending ?? 0);
  return floor > 0 ? floor : 0;
}

export function reportedLfFromSta(
  beginSta: string,
  endSta: string,
  conversionFactor: number,
): number {
  if (conversionFactor <= 0) {
    throw new Error("Conversion factor must be greater than 0");
  }
  return physicalLfFromSta(beginSta, endSta) * conversionFactor;
}

/** Normalized project corridor + total physical LF for field crew display */
export function projectStaScope(
  beginSta: string,
  endSta: string,
): { beginSta: string; endSta: string; totalLf: number } {
  const begin = normalizeSta(beginSta);
  const end = normalizeSta(endSta);
  return {
    beginSta: begin,
    endSta: end,
    totalLf: physicalLfFromSta(begin, end),
  };
}

/** Field-level bounds checks against project/task corridor. */
export function staSegmentProjectBoundsErrors(
  beginSta: string,
  endSta: string,
  projectBounds: { beginSta: string; endSta: string } | null | undefined,
): Record<string, string> {
  if (!projectBounds?.beginSta?.trim() || !projectBounds?.endSta?.trim()) {
    return {};
  }
  try {
    const lo = parseStaToDecimal(projectBounds.beginSta);
    const hi = parseStaToDecimal(projectBounds.endSta);
    const minB = Math.min(lo, hi);
    const maxB = Math.max(lo, hi);
    const b0 = parseStaToDecimal(beginSta);
    const b1 = parseStaToDecimal(endSta);
    const segLo = Math.min(b0, b1);
    const segHi = Math.max(b0, b1);
    if (segLo < minB || segHi > maxB) {
      return {
        endSta: `Must stay within ${projectBounds.beginSta} – ${projectBounds.endSta}`,
      };
    }
  } catch {
    return {};
  }
  return {};
}

/** Task STA limits take priority; fall back to project route limits. */
export function resolveStaWorkLimits(
  task: { beginSta?: string | null; endSta?: string | null } | null | undefined,
  projectRoute: { beginSta?: string | null; endSta?: string | null } | null | undefined,
): { beginSta: string; endSta: string } | null {
  if (task?.beginSta?.trim() && task?.endSta?.trim()) {
    try {
      return {
        beginSta: normalizeSta(task.beginSta),
        endSta: normalizeSta(task.endSta),
      };
    } catch {
      return null;
    }
  }
  if (projectRoute?.beginSta?.trim() && projectRoute?.endSta?.trim()) {
    try {
      return {
        beginSta: normalizeSta(projectRoute.beginSta),
        endSta: normalizeSta(projectRoute.endSta),
      };
    } catch {
      return null;
    }
  }
  return null;
}
