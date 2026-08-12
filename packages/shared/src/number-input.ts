/** Strip minus signs from decimal number inputs (field qty, LF, CF). */
export function sanitizeNonNegativeDecimalInput(value: string): string {
  return value.replace(/-/g, "");
}

/** Strip minus signs from STA text (e.g. 142+50). */
export function sanitizeStaInput(value: string): string {
  return value.replace(/-/g, "");
}

/** Block minus and scientific notation keys on number inputs. */
export function blockNegativeNumberKeys(
  e: { key: string; preventDefault: () => void },
): void {
  if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") {
    e.preventDefault();
  }
}
