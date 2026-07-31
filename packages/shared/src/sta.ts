/**
 * Station (STA) normalize + parse (FR-FLD-005).
 * Accepts `142+50` and `142.50`; stores/display as plus-sign form.
 */

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

/** True when two STA ranges share any station (touching endpoints are OK). */
export function staRangesOverlap(
  aBegin: string,
  aEnd: string,
  bBegin: string,
  bEnd: string,
): boolean {
  const a0 = parseStaToDecimal(aBegin);
  const a1 = parseStaToDecimal(aEnd);
  const b0 = parseStaToDecimal(bBegin);
  const b1 = parseStaToDecimal(bEnd);
  return b0 < a1 && a0 < b1;
}

/** Billable quantity from a STA range — unit-aware (STA stations vs LF). */
export function quantityFromStaRange(
  unit: string,
  beginSta: string,
  endSta: string,
  conversionFactor = 1,
): number {
  const u = unit.trim().toUpperCase();
  if (u === "STA") {
    return stationSpanDecimal(beginSta, endSta);
  }
  if (u === "LF") {
    return reportedLfFromSta(beginSta, endSta, conversionFactor);
  }
  return physicalLfFromSta(beginSta, endSta);
}

/** Task progress estimate from work limits or reported totals. */
export function estimateTaskQuantity(input: {
  unit: string;
  formType: string;
  conversionFactor?: number | null;
  beginSta?: string | null;
  endSta?: string | null;
  routeBeginSta?: string | null;
  routeEndSta?: string | null;
  reportedApproved?: number;
  reportedPending?: number;
}): number {
  const begin = input.beginSta?.trim() || input.routeBeginSta?.trim();
  const end = input.endSta?.trim() || input.routeEndSta?.trim();

  if (input.formType === "STA_RANGE" && begin && end) {
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

/** Field-level bounds checks — disabled for field entry (crews may enter any STA span). */
export function staSegmentProjectBoundsErrors(
  _beginSta: string,
  _endSta: string,
  _projectBounds: { beginSta: string; endSta: string } | null | undefined,
): Record<string, string> {
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
