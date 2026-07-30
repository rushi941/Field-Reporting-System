import { useEffect, useMemo, useState } from "react";
import {
  ADMIN_PAGE_SIZE,
  filterRowsBySearch,
  paginateSlice,
  sortRows,
  type SortDirection,
} from "@/lib/admin-table";

export type SortAccessor<T> = (
  row: T,
) => string | number | boolean | null | undefined;

export function useAdminTable<T>({
  rows,
  pageSize = ADMIN_PAGE_SIZE,
  getSearchText,
  sortAccessors,
  defaultSort,
}: {
  rows: T[];
  pageSize?: number;
  getSearchText: (row: T) => string;
  sortAccessors: Record<string, SortAccessor<T>>;
  defaultSort: { key: string; direction: SortDirection };
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(defaultSort.key);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSort.direction);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setPage(1);
        setSearch(next);
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput, search]);

  const processed = useMemo(() => {
    const filtered = filterRowsBySearch(rows, search, getSearchText);
    return sortRows(filtered, sortKey, sortDir, sortAccessors);
  }, [rows, search, sortKey, sortDir, getSearchText, sortAccessors]);

  const paginated = useMemo(
    () => paginateSlice(processed, page, pageSize),
    [processed, page, pageSize],
  );

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  return {
    searchInput,
    setSearchInput,
    search,
    sortKey,
    sortDir,
    toggleSort,
    page,
    setPage,
    paginated,
    total: processed.length,
  };
}
