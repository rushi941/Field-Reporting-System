import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminTableSearch } from "@/components/admin-table-search";
import { SortableTh } from "@/components/sortable-table-head";
import { TablePagination } from "@/components/table-pagination";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-table";
import { useAdminTable } from "@/hooks/use-admin-table";

type RollupProject = {
  id: string;
  jobNumber: string;
  name: string;
  location: string | null;
  division: string;
  clientName: string | null;
  status: string;
  projectAdmin: { name: string; email: string } | null;
  pendingCount: number;
  returnedCount: number;
  approvedCount: number;
  totalCount: number;
  lastReportDate: string | null;
  needsAttention: boolean;
};

type PendingReport = {
  id: string;
  reportNumber: string;
  reportDate: string;
  ageLabel: string;
  lineCount: number;
  attachmentCount: number;
  project: {
    id: string;
    jobNumber: string;
    name: string;
    location: string | null;
  };
  submittedBy: { name: string };
};

const divisionLabels: Record<string, string> = {
  PAVEMENT_MARKING: "Pavement Marking",
  TRAFFIC_CONTROL: "Traffic Control",
  PERMANENT_SIGNS: "Permanent Signs",
  MISCELLANEOUS: "Miscellaneous",
};

type ProjectStatusFilter = "ALL" | "ACTIVE" | "COMPLETED";
type AttentionFilter = "ALL" | "NEEDS_ATTENTION" | "PENDING";

export function AdminApprovalsPage({ base }: { base: "system" }) {
  const [projects, setProjects] = useState<RollupProject[]>([]);
  const [pending, setPending] = useState<PendingReport[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("ALL");
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("ALL");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [rollup, queue] = await Promise.all([
          apiFetch<{ projects: RollupProject[]; pendingTotal: number }>(
            "/api/v1/approvals/rollup",
          ),
          apiFetch<{ reports: PendingReport[]; pendingCount: number }>(
            "/api/v1/approvals/pending",
          ),
        ]);
        setProjects(rollup.projects);
        setPendingTotal(rollup.pendingTotal);
        setPending(queue.reports);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load approvals");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (divisionFilter !== "ALL" && p.division !== divisionFilter) return false;
      if (attentionFilter === "NEEDS_ATTENTION" && !p.needsAttention) return false;
      if (attentionFilter === "PENDING" && p.pendingCount === 0) return false;
      return true;
    });
  }, [projects, statusFilter, divisionFilter, attentionFilter]);

  const projectSortAccessors = useMemo(
    () => ({
      jobNumber: (p: RollupProject) => p.jobNumber,
      client: (p: RollupProject) =>
        [p.clientName, p.location].filter(Boolean).join(" "),
      status: (p: RollupProject) => p.status,
      pending: (p: RollupProject) => p.pendingCount,
      approved: (p: RollupProject) => p.approvedCount,
      returned: (p: RollupProject) => p.returnedCount,
      lastReport: (p: RollupProject) => p.lastReportDate ?? "",
    }),
    [],
  );

  const projectsTable = useAdminTable({
    rows: filteredProjects,
    getSearchText: (p) =>
      `${p.jobNumber} ${p.name} ${p.clientName ?? ""} ${p.location ?? ""} ${p.projectAdmin?.name ?? ""}`,
    sortAccessors: projectSortAccessors,
    defaultSort: { key: "pending", direction: "desc" },
  });

  const pendingSortAccessors = useMemo(
    () => ({
      reportNumber: (r: PendingReport) => r.reportNumber,
      project: (r: PendingReport) => r.project.jobNumber,
      submittedBy: (r: PendingReport) => r.submittedBy.name,
      date: (r: PendingReport) => r.reportDate,
      age: (r: PendingReport) => r.ageLabel,
    }),
    [],
  );

  const pendingTable = useAdminTable({
    rows: pending,
    getSearchText: (r) =>
      `${r.reportNumber} ${r.project.jobNumber} ${r.project.name} ${r.submittedBy.name}`,
    sortAccessors: pendingSortAccessors,
    defaultSort: { key: "date", direction: "desc" },
  });

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading approvals…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review pending field reports across all running and completed projects.
          Approve, return, or open project history.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Pending review" value={pendingTotal} warn={pendingTotal > 0} />
        <StatCard
          label="Active projects"
          value={projects.filter((p) => p.status === "ACTIVE").length}
        />
        <StatCard
          label="Completed projects"
          value={projects.filter((p) => p.status === "COMPLETED").length}
        />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Pending queue</h2>
            <p className="text-xs text-muted-foreground">
              Reports waiting for approval company-wide
            </p>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center">
            <ClipboardCheck className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">Queue is clear</p>
          </div>
        ) : (
          <>
            <AdminTableSearch
              className="max-w-sm"
              value={pendingTable.searchInput}
              onChange={pendingTable.setSearchInput}
              placeholder="Search pending reports…"
            />
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <SortableTh label="Report #" sortKey="reportNumber" activeSortKey={pendingTable.sortKey} sortDir={pendingTable.sortDir} onSort={pendingTable.toggleSort} />
                    <SortableTh label="Project" sortKey="project" activeSortKey={pendingTable.sortKey} sortDir={pendingTable.sortDir} onSort={pendingTable.toggleSort} />
                    <SortableTh label="Submitted by" sortKey="submittedBy" activeSortKey={pendingTable.sortKey} sortDir={pendingTable.sortDir} onSort={pendingTable.toggleSort} />
                    <SortableTh label="Date" sortKey="date" activeSortKey={pendingTable.sortKey} sortDir={pendingTable.sortDir} onSort={pendingTable.toggleSort} />
                    <SortableTh label="Age" sortKey="age" activeSortKey={pendingTable.sortKey} sortDir={pendingTable.sortDir} onSort={pendingTable.toggleSort} />
                    <th className="px-2 py-1 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTable.total === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No pending reports match your search.
                      </td>
                    </tr>
                  )}
                  {pendingTable.paginated.items.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-1 font-mono text-xs">{r.reportNumber}</td>
                      <td className="px-2 py-1">
                        <p className="font-medium">{r.project.jobNumber}</p>
                        <p className="text-xs text-muted-foreground">{r.project.name}</p>
                      </td>
                      <td className="px-2 py-1 text-xs">{r.submittedBy.name}</td>
                      <td className="px-2 py-1 tabular-nums text-xs">{r.reportDate}</td>
                      <td className="px-2 py-1 text-xs">{r.ageLabel}</td>
                      <td className="px-2 py-1 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/${base}/approvals/reports/${r.id}`}>Review</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination
                page={pendingTable.paginated.page}
                pageSize={ADMIN_PAGE_SIZE}
                total={pendingTable.paginated.total}
                onPageChange={pendingTable.setPage}
              />
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">All projects</h2>
          <p className="text-xs text-muted-foreground">
            Running and completed jobs with report activity
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="Project status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as ProjectStatusFilter)}
            options={[
              { value: "ALL", label: "All statuses" },
              { value: "ACTIVE", label: "Running" },
              { value: "COMPLETED", label: "Completed" },
            ]}
          />
          <FilterSelect
            label="Division"
            value={divisionFilter}
            onChange={setDivisionFilter}
            options={[
              { value: "ALL", label: "All divisions" },
              ...Object.entries(divisionLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <FilterSelect
            label="Attention"
            value={attentionFilter}
            onChange={(v) => setAttentionFilter(v as AttentionFilter)}
            options={[
              { value: "ALL", label: "All projects" },
              { value: "NEEDS_ATTENTION", label: "Needs attention" },
              { value: "PENDING", label: "Has pending" },
            ]}
          />
        </div>

        <AdminTableSearch
          className="max-w-sm"
          value={projectsTable.searchInput}
          onChange={projectsTable.setSearchInput}
          placeholder="Search projects…"
        />

        {filteredProjects.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No projects match your filters.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <SortableTh label="Job" sortKey="jobNumber" activeSortKey={projectsTable.sortKey} sortDir={projectsTable.sortDir} onSort={projectsTable.toggleSort} />
                    <SortableTh label="Client / location" sortKey="client" activeSortKey={projectsTable.sortKey} sortDir={projectsTable.sortDir} onSort={projectsTable.toggleSort} />
                    <SortableTh label="Status" sortKey="status" activeSortKey={projectsTable.sortKey} sortDir={projectsTable.sortDir} onSort={projectsTable.toggleSort} />
                    <SortableTh label="Pending" sortKey="pending" activeSortKey={projectsTable.sortKey} sortDir={projectsTable.sortDir} onSort={projectsTable.toggleSort} align="right" />
                    <SortableTh label="Approved" sortKey="approved" activeSortKey={projectsTable.sortKey} sortDir={projectsTable.sortDir} onSort={projectsTable.toggleSort} align="right" />
                    <SortableTh label="Returned" sortKey="returned" activeSortKey={projectsTable.sortKey} sortDir={projectsTable.sortDir} onSort={projectsTable.toggleSort} align="right" />
                    <SortableTh label="Last report" sortKey="lastReport" activeSortKey={projectsTable.sortKey} sortDir={projectsTable.sortDir} onSort={projectsTable.toggleSort} />
                    <th className="px-2 py-1 font-medium text-right">History</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsTable.total === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-2 py-6 text-center text-sm text-muted-foreground"
                      >
                        {projectsTable.search
                          ? "No projects match your search."
                          : "No projects match your filters."}
                      </td>
                    </tr>
                  )}
                  {projectsTable.paginated.items.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-2 py-1">
                        <p className="font-semibold">{p.jobNumber}</p>
                        <p className="text-xs text-muted-foreground">{p.name}</p>
                      </td>
                      <td className="px-2 py-1 text-xs text-muted-foreground">
                        {[p.clientName, p.location].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            p.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-slate-100 text-slate-800",
                          )}
                        >
                          {p.status === "ACTIVE" ? "Running" : "Completed"}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1 text-right tabular-nums font-medium",
                          p.pendingCount > 0 && "text-amber-700",
                        )}
                      >
                        {p.pendingCount}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {p.approvedCount}
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
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/${base}/approvals/projects/${p.id}`}>
                            Open
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {projectsTable.total > 0 && (
            <TablePagination
              page={projectsTable.paginated.page}
              pageSize={ADMIN_PAGE_SIZE}
              total={projectsTable.paginated.total}
              onPageChange={projectsTable.setPage}
            />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        warn && value > 0 && "border-amber-200 bg-amber-50/60",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        className="h-9 rounded-md border border-input bg-card px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
