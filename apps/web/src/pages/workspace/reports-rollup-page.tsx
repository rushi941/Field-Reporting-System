import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/table-pagination";
import { AdminTableSearch } from "@/components/admin-table-search";
import { ScrollableText } from "@/components/scrollable-text";
import { SortableTh } from "@/components/sortable-table-head";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-table";
import { useAdminTable } from "@/hooks/use-admin-table";

type RollupProject = {
  id: string;
  jobNumber: string;
  name: string;
  location: string | null;
  division: string;
  clientName: string | null;
  taskCount: number;
  pendingCount: number;
  returnedCount: number;
  approvedCount: number;
  totalCount: number;
  lastReportDate: string | null;
  needsAttention: boolean;
  projectAdmin: { name: string } | null;
};

export function WorkspaceReportsRollupPage({
  base,
}: {
  base: "office" | "system";
}) {
  const [projects, setProjects] = useState<RollupProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "attention">("all");

  const filtered = useMemo(() => {
    if (filter === "attention") {
      return projects.filter((p) => p.needsAttention);
    }
    return projects;
  }, [projects, filter]);

  const reportSortAccessors = useMemo(
    () => ({
      jobNumber: (p: RollupProject) => p.jobNumber,
      client: (p: RollupProject) =>
        [p.clientName, p.location].filter(Boolean).join(" "),
      tasks: (p: RollupProject) => p.taskCount,
      approved: (p: RollupProject) => p.approvedCount,
      pending: (p: RollupProject) => p.pendingCount,
      returned: (p: RollupProject) => p.returnedCount,
      lastReport: (p: RollupProject) => p.lastReportDate ?? "",
    }),
    [],
  );

  const {
    searchInput,
    setSearchInput,
    search,
    sortKey,
    sortDir,
    toggleSort,
    paginated,
    setPage: setTablePage,
    total: filteredTotal,
  } = useAdminTable({
    rows: filtered,
    getSearchText: (p) =>
      `${p.jobNumber} ${p.name} ${p.clientName ?? ""} ${p.location ?? ""}`,
    sortAccessors: reportSortAccessors,
    defaultSort: { key: "jobNumber", direction: "asc" },
  });

  useEffect(() => {
    setTablePage(1);
  }, [filter, setTablePage]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ projects: RollupProject[] }>(
          "/api/v1/workspace-reports/rollup",
        );
        setProjects(data.projects);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load reports");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = useMemo(() => {
    return projects.reduce(
      (acc, p) => {
        acc.approved += p.approvedCount;
        acc.pending += p.pendingCount;
        acc.returned += p.returnedCount;
        if (p.needsAttention) acc.attention += 1;
        return acc;
      },
      { approved: 0, pending: 0, returned: 0, attention: 0 },
    );
  }, [projects]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading project reports…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Tracking
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Project-wise field report tracking. Open a job to see daily reports,
          statuses, and progress.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Approved" value={String(totals.approved)} />
        <Metric label="Under review" value={String(totals.pending)} highlight />
        <Metric label="Returned" value={String(totals.returned)} />
        <Metric label="Needs attention" value={String(totals.attention)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All projects ({projects.length})
        </FilterChip>
        <FilterChip
          active={filter === "attention"}
          onClick={() => setFilter("attention")}
        >
          Needs attention ({totals.attention})
        </FilterChip>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No active projects in your scope.
        </p>
      ) : (
        <>
          <AdminTableSearch
            className="max-w-sm"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search report projects…"
          />
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <SortableTh label="Job" sortKey="jobNumber" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Client / location" sortKey="client" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Tasks" sortKey="tasks" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="Approved" sortKey="approved" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="Pending" sortKey="pending" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="Returned" sortKey="returned" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="Last report" sortKey="lastReport" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-2 py-1 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTotal === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-2 py-6 text-center text-sm text-muted-foreground"
                      >
                        {search
                          ? "No projects match your search."
                          : filter === "attention"
                            ? "No projects with pending or returned reports."
                            : "No projects match your filters."}
                      </td>
                    </tr>
                  )}
                  {paginated.items.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-2 py-1">
                        <Link
                          to={`/${base}/reports/${p.id}`}
                          className="font-semibold hover:underline"
                        >
                          {p.jobNumber}
                        </Link>
                        <ScrollableText maxHeight="max-h-12" className="text-xs text-muted-foreground">
                          {p.name}
                        </ScrollableText>
                      </td>
                      <td className="px-2 py-1 text-xs text-muted-foreground">
                        {[p.clientName, p.location].filter(Boolean).join(" · ") ||
                          "—"}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {p.taskCount}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {p.approvedCount}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1 text-right tabular-nums font-medium",
                          p.pendingCount > 0 && "text-amber-700",
                        )}
                      >
                        {p.pendingCount}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1 text-right tabular-nums",
                          p.returnedCount > 0 && "text-amber-700",
                        )}
                      >
                        {p.returnedCount}
                      </td>
                      <td className="px-2 py-1 text-xs tabular-nums">
                        {p.lastReportDate ?? "—"}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <Link
                          to={`/${base}/reports/${p.id}`}
                          className="text-sm font-medium text-sky-800 hover:underline"
                        >
                          View reports
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="space-y-2 md:hidden">
            {filteredTotal === 0 ? (
              <li className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {search
                  ? "No projects match your search."
                  : filter === "attention"
                    ? "No projects with pending or returned reports."
                    : "No projects match your filters."}
              </li>
            ) : (
              paginated.items.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/${base}/reports/${p.id}`}
                    className="block rounded-lg border bg-card px-4 py-3 shadow-sm"
                  >
                    <p className="font-semibold">{p.jobNumber}</p>
                    <p className="text-sm text-muted-foreground">{p.name}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {p.approvedCount} approved · {p.pendingCount} pending ·{" "}
                      {p.returnedCount} returned
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>

          {filteredTotal > 0 && (
            <TablePagination
              page={paginated.page}
              pageSize={ADMIN_PAGE_SIZE}
              total={filteredTotal}
              onPageChange={setTablePage}
            />
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        highlight && "border-amber-200 bg-amber-50/60",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-sky-300 bg-sky-50 text-sky-950"
          : "border-border bg-card text-muted-foreground hover:bg-muted/50",
      )}
    >
      {children}
    </button>
  );
}
