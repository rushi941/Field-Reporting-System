/** Default page size for admin / master list tables */
export const ADMIN_PAGE_SIZE = 25;

export type SortDirection = "asc" | "desc";

export type PaginatedSlice<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function paginateSlice<T>(
  items: T[],
  page: number,
  pageSize = ADMIN_PAGE_SIZE,
): PaginatedSlice<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

export function compareSortValues(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
  direction: SortDirection,
): number {
  const mul = direction === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return (Number(a) - Number(b)) * mul;
  }
  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * mul;
  }
  return (
    String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * mul
  );
}

export function filterRowsBySearch<T>(
  rows: T[],
  query: string,
  getSearchText: (row: T) => string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => getSearchText(row).toLowerCase().includes(q));
}

export function sortRows<T>(
  rows: T[],
  sortKey: string,
  direction: SortDirection,
  accessors: Record<string, (row: T) => string | number | boolean | null | undefined>,
): T[] {
  const accessor = accessors[sortKey];
  if (!accessor) return rows;
  return [...rows].sort((a, b) =>
    compareSortValues(accessor(a), accessor(b), direction),
  );
}
