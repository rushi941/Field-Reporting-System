import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { AdminTableSearch } from "@/components/admin-table-search";
import { SortableTh } from "@/components/sortable-table-head";
import { Button } from "@/components/ui/button";
import type { useAdminTable } from "@/hooks/use-admin-table";
import { workspaceHref } from "@/lib/workspace-path";
import {
  computeProgressShares,
  formatProgressDetail,
  formatProgressPercent,
  formatQty,
  progressBarWidthPct,
} from "@/lib/task-progress-display";

export type BidItemTaskRow = {
  id: string;
  taskMasterId?: string;
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

type BidItemTaskTableProps = {
  projectId: string;
  base: "office" | "system";
  tasks: BidItemTaskRow[];
  table: ReturnType<typeof useAdminTable<BidItemTaskRow>>;
  toolbarExtra?: ReactNode;
  onEdit?: (row: BidItemTaskRow) => void;
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
  onEdit,
  onRemove,
  saving = false,
  showViewEntries = true,
  emptyMessage,
  filteredEmptyMessage,
  totalTasksCount,
}: BidItemTaskTableProps) {
  const projectHasNoTasks = (totalTasksCount ?? tasks.length) === 0;

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

  const colSpan = 7;

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
              <th className="w-32 px-2 py-1 text-right">Actions</th>
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
              const { estimated, approved, pending } = t.progress;
              const unit = t.taskMaster.unit;
              const { approvedPct, pendingPct, totalPct } = computeProgressShares(
                estimated,
                approved,
                pending,
              );
              const pctLabel = formatProgressPercent(totalPct);
              const progressDetail = formatProgressDetail(
                estimated,
                approved,
                pending,
                unit,
              );

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
                    {pending > 0 && (
                      <p className="text-[10px] text-amber-700">
                        +{formatQty(pending)} pend
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-sky-800">
                        {pctLabel}
                      </span>
                      <div
                        className="flex h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={Math.round(totalPct * 10) / 10}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${pctLabel} reported`}
                      >
                        {approvedPct > 0 && (
                          <div
                            className="h-full bg-emerald-600"
                            style={{
                              width: `${progressBarWidthPct(approvedPct, approved > 0)}%`,
                            }}
                          />
                        )}
                        {pendingPct > 0 && (
                          <div
                            className="h-full bg-amber-500"
                            style={{
                              width: `${progressBarWidthPct(pendingPct, pending > 0)}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                    {progressDetail && (
                      <p className="mt-0.5 pl-14 text-[11px] tabular-nums text-muted-foreground">
                        {progressDetail}
                      </p>
                    )}
                  </td>
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
                      {onEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="iconSm"
                          disabled={saving}
                          title="Edit task"
                          onClick={() => onEdit(t)}
                        >
                          <Pencil className="size-4" />
                        </Button>
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
