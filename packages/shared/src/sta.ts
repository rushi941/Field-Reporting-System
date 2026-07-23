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

/** Physical LF from Begin/End STA */
export function physicalLfFromSta(beginSta: string, endSta: string): number {
  const begin = parseStaToDecimal(beginSta);
  const end = parseStaToDecimal(endSta);
  if (end <= begin) throw new Error("End STA must be greater than Begin STA");
  return (end - begin) * 100;
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

/** Field-level errors when a segment exceeds project begin/end STA */
export function staSegmentProjectBoundsErrors(
  beginSta: string,
  endSta: string,
  projectBounds: { beginSta: string; endSta: string } | null | undefined,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!projectBounds?.beginSta?.trim() || !projectBounds?.endSta?.trim()) {
    return errors;
  }
  try {
    const pb = normalizeSta(projectBounds.beginSta);
    const pe = normalizeSta(projectBounds.endSta);
    const pbDec = parseStaToDecimal(pb);
    const peDec = parseStaToDecimal(pe);

    if (beginSta.trim()) {
      const begin = normalizeSta(beginSta);
      const beginDec = parseStaToDecimal(begin);
      if (beginDec < pbDec) {
        errors.beginSta = `Cannot be before allowed start (${pb})`;
      }
      if (beginDec >= peDec) {
        errors.beginSta = `Must be before allowed end (${pe})`;
      }
    }

    if (endSta.trim()) {
      const end = normalizeSta(endSta);
      const endDec = parseStaToDecimal(end);
      if (endDec > peDec) {
        errors.endSta = `Cannot exceed allowed end (${pe})`;
      }
      if (beginSta.trim()) {
        const beginDec = parseStaToDecimal(normalizeSta(beginSta));
        if (endDec <= beginDec) {
          errors.endSta = "End STA must be greater than Begin STA";
        }
      }
    }
  } catch {
    /* ignore while user is typing partial values */
  }
  return errors;
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
