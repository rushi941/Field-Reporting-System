/** Default page size for admin / master list tables */
export const ADMIN_PAGE_SIZE = 25;

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
