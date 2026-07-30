import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/admin-table";

type SortableThProps = {
  label: string;
  sortKey: string;
  activeSortKey: string;
  sortDir: SortDirection;
  onSort: (key: string) => void;
  className?: string;
  align?: "left" | "right" | "center";
};

export function SortableTh({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  className,
  align = "left",
}: SortableThProps) {
  const active = activeSortKey === sortKey;
  const Icon = active
    ? sortDir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th
      className={cn(
        "px-2 py-1",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
          align === "right" && "ml-auto",
        )}
      >
        {label}
        <Icon className={cn("size-3.5 shrink-0", !active && "opacity-40")} />
      </button>
    </th>
  );
}
