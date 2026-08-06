import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { AdminTableSearch } from "@/components/admin-table-search";
import { SortableTh } from "@/components/sortable-table-head";
import { Button } from "@/components/ui/button";
import type { useAdminTable } from "@/hooks/use-admin-table";
import { workspaceHref } from "@/lib/workspace-path";

export type BidItemTaskRow = {
  id: string;
  taskMasterId?: string;
  assignedTo: { name: string; email: string } | null;
  taskMaster: {
    code: string;
    name: string;
    unit: string;
    formType: string;
  };
  progress: {
    estimated: number;
    approved: number;
    pending: number;
    approvedPct: number;
  };
};

function formatQty(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function progressPct(estimated: number, approved: number): number {
  if (estimated <= 0) return approved > 0 ? 100 : 0;
  return Math.min(100, Math.round((approved / estimated) * 100));
}

type BidItemTaskTableProps = {
  projectId: string;
  base: "office" | "system";
  tasks: BidItemTaskRow[];
  table: ReturnType<typeof useAdminTable<BidItemTaskRow>>;
  toolbarExtra?: ReactNode;
  onRemove?: (taskMasterId: string) => void;
  saving?: boolean;
  showViewEntries?: boolean;
  emptyMessage?: ReactNode;
  filteredEmptyMessage?: ReactNode;
  totalTasksCount?: number;
};

export function BidItemTaskTable({
  projectId,
  base,
  tasks,
  table,
  toolbarExtra,
  onRemove,
  saving = false,
  showViewEntries = true,
  emptyMessage,
  filteredEmptyMessage,
  totalTasksCount,
}: BidItemTaskTableProps) {
  const projectHasNoTasks = (totalTasksCount ?? tasks.length) === 0;
  const showFieldColumn = Boolean(onRemove);

  if (projectHasNoTasks) {
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <h2 className="shrink-0 text-sm font-semibold">Project tasks (0)</h2>
        </div>
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage ?? "No tasks on this project yet."}
        </p>
      </div>
    );
  }

  const colSpan = showFieldColumn ? 8 : 7;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <h2 className="shrink-0 text-sm font-semibold">
          Project tasks ({totalTasksCount ?? tasks.length})
        </h2>
        <AdminTableSearch
          value={table.searchInput}
          onChange={table.setSearchInput}
          placeholder="Search tasks…"
          className="min-w-[10rem] max-w-md flex-1"
        />
        {toolbarExtra}
        <span className="ml-auto text-xs text-muted-foreground">
          {table.total} items
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <SortableTh
                label="#"
                sortKey="code"
                activeSortKey={table.sortKey}
                sortDir={table.sortDir}
                onSort={table.toggleSort}
                className="w-24"
              />
              <SortableTh
                label="Item description"
                sortKey="name"
                activeSortKey={table.sortKey}
                sortDir={table.sortDir}
                onSort={table.toggleSort}
              />
              <SortableTh
                label="Unit"
                sortKey="unit"
                activeSortKey={table.sortKey}
                sortDir={table.sortDir}
                onSort={table.toggleSort}
                className="w-16"
              />
              <SortableTh
                label="Plan qty"
                sortKey="planQty"
                activeSortKey={table.sortKey}
                sortDir={table.sortDir}
                onSort={table.toggleSort}
                className="w-24"
                align="right"
              />
              <SortableTh
                label="Installed"
                sortKey="installed"
                activeSortKey={table.sortKey}
                sortDir={table.sortDir}
                onSort={table.toggleSort}
                className="w-24"
                align="right"
              />
              <SortableTh
                label="Progress"
                sortKey="progress"
                activeSortKey={table.sortKey}
                sortDir={table.sortDir}
                onSort={table.toggleSort}
                className="min-w-[140px]"
              />
              {showFieldColumn && (
                <SortableTh
                  label="Field person"
                  sortKey="lead"
                  activeSortKey={table.sortKey}
                  sortDir={table.sortDir}
                  onSort={table.toggleSort}
                  className="w-32"
                />
              )}
              <th className="w-28 px-2 py-1 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.total === 0 && (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-2 py-4 text-center text-sm text-muted-foreground"
                >
                  {filteredEmptyMessage ?? "No tasks match your search."}
                </td>
              </tr>
            )}
            {table.paginated.items.map((t) => {
              const { estimated, approved } = t.progress;
              const unit = t.taskMaster.unit;
              const pct = progressPct(estimated, approved);

              return (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="px-2 py-2 font-mono text-xs text-sky-800">
                    {t.taskMaster.code}
                  </td>
                  <td className="px-2 py-2">
                    <p className="font-medium leading-snug">{t.taskMaster.name}</p>
                  </td>
                  <td className="px-2 py-2 text-xs uppercase text-muted-foreground">
                    {unit}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatQty(estimated)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatQty(approved)}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-sky-800">
                        {pct}%
                      </span>
                      <div
                        className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${pct}% installed`}
                      >
                        <div
                          className="h-full bg-sky-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {estimated > 0 && (
                      <p className="mt-0.5 pl-11 text-[11px] tabular-nums text-muted-foreground">
                        {formatQty(approved)} / {formatQty(estimated)} {unit}
                      </p>
                    )}
                  </td>
                  {showFieldColumn && (
                    <td className="px-2 py-2 text-xs">
                      {t.assignedTo?.name ?? "—"}
                    </td>
                  )}
                  <td className="px-2 py-2 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      {showViewEntries && (
                        <Link
                          to={workspaceHref(
                            base,
                            `reports/${projectId}/tasks/${t.id}`,
                          )}
                          className="text-xs font-medium text-sky-800 hover:underline"
                        >
                          View entries &gt;
                        </Link>
                      )}
                      {onRemove && t.taskMasterId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="iconSm"
                          disabled={saving}
                          title="Remove task"
                          onClick={() => onRemove(t.taskMasterId!)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
