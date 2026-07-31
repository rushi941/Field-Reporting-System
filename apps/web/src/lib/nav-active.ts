/** Reports rollup — active on /reports and /reports/:id, not /reports/history */
export function isReportsNavActive(pathname: string, reportsBase: string): boolean {
  if (pathname === reportsBase) return true;
  if (!pathname.startsWith(`${reportsBase}/`)) return false;
  return !pathname.startsWith(`${reportsBase}/history`);
}

/** Billing rollup — active on /billing and /billing/:projectId only */
export function isBillingNavActive(pathname: string, billingBase: string): boolean {
  return pathname === billingBase || pathname.startsWith(`${billingBase}/`);
}

type NavMatchItem = {
  to: string;
  end?: boolean;
  isActivePath?: (pathname: string) => boolean;
};

export function isNavItemActive(item: NavMatchItem, pathname: string): boolean {
  if (item.isActivePath) return item.isActivePath(pathname);
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/** Pick the single most specific nav match so parent routes never stay highlighted. */
export function resolveActiveNavTo(
  items: readonly NavMatchItem[],
  pathname: string,
): string | null {
  let best: NavMatchItem | null = null;
  for (const item of items) {
    if (!isNavItemActive(item, pathname)) continue;
    if (!best || item.to.length > best.to.length) best = item;
  }
  return best?.to ?? null;
}
