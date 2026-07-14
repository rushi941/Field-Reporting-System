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

export function reportedLfFromSta(
  beginSta: string,
  endSta: string,
  conversionFactor: number,
): number {
  return physicalLfFromSta(beginSta, endSta) * conversionFactor;
}
