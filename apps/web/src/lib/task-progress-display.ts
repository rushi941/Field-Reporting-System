export type ProgressShares = {
  approvedPct: number;
  pendingPct: number;
  totalPct: number;
};

/** Approved + pending shares of plan quantity (0–100 each, not rounded). */
export function computeProgressShares(
  estimated: number,
  approved: number,
  pending: number,
): ProgressShares {
  if (estimated <= 0) {
    const reported = approved + pending;
    if (reported <= 0) return { approvedPct: 0, pendingPct: 0, totalPct: 0 };
    const approvedPct = (approved / reported) * 100;
    return {
      approvedPct,
      pendingPct: 100 - approvedPct,
      totalPct: 100,
    };
  }

  const approvedPct = Math.min(100, (approved / estimated) * 100);
  const pendingPct = Math.min(100 - approvedPct, (pending / estimated) * 100);
  return {
    approvedPct,
    pendingPct,
    totalPct: Math.min(100, approvedPct + pendingPct),
  };
}

/** Human-readable percent — keeps small non-zero values visible. */
export function formatProgressPercent(pct: number): string {
  if (pct <= 0) return "0%";
  if (pct >= 100) return "100%";
  if (pct < 0.05) return "<0.1%";
  if (pct < 1) return `${pct.toFixed(1)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

/** Minimum bar segment width when quantity is reported but % is tiny. */
export function progressBarWidthPct(pct: number, hasQuantity: boolean): number {
  if (pct <= 0) return hasQuantity ? 1.5 : 0;
  return Math.min(100, pct);
}

export function formatQty(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatProgressDetail(
  estimated: number,
  approved: number,
  pending: number,
  unit: string,
): string | null {
  const reported = approved + pending;
  if (reported <= 0 && estimated <= 0) return null;

  if (estimated > 0) {
    if (pending > 0 && approved > 0) {
      return `${formatQty(approved)} appr · ${formatQty(pending)} pend / ${formatQty(estimated)} ${unit}`;
    }
    if (pending > 0) {
      return `${formatQty(pending)} pending / ${formatQty(estimated)} ${unit}`;
    }
    return `${formatQty(approved)} / ${formatQty(estimated)} ${unit}`;
  }

  if (reported > 0) {
    return `${formatQty(reported)} reported (no plan qty)`;
  }

  return null;
}
