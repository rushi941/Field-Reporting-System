import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { frdStatusLabels } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminTableSearch } from "@/components/admin-table-search";
import { SortableTh } from "@/components/sortable-table-head";
import { TablePagination } from "@/components/table-pagination";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-table";
import { useAdminTable } from "@/hooks/use-admin-table";

type ProjectInfo = {
  id: string;
  jobNumber: string;
  name: string;
  location: string | null;
  clientName: string | null;
};

type HistoryReport = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  ageLabel: string;
  lineCount: number;
  returnComment: string | null;
  approvalNotes: string | null;
  submittedBy: { name: string };
  approvedBy: { name: string } | null;
};

const statusStyles: Record<string, string> = {
  SUBMITTED: "bg-sky-100 text-sky-900",
  RETURNED: "bg-amber-100 text-amber-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  APPROVED_WITH_NOTES: "bg-emerald-100 text-emerald-900",
};

type StatusFilter = "ALL" | "SUBMITTED" | "RETURNED" | "APPROVED";

export function AdminApprovalsProjectPage({ base }: { base: "system" }) {
  const { projectId } = useParams();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [reports, setReports] = useState<HistoryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{
          project: ProjectInfo;
          reports: HistoryReport[];
        }>(`/api/v1/approvals/history?projectId=${encodeURIComponent(projectId)}`);
        setProject(data.project);
        setReports(data.reports);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const filteredReports = useMemo(() => {
    if (statusFilter === "ALL") return reports;
    if (statusFilter === "APPROVED") {
      return reports.filter(
        (r) => r.status === "APPROVED" || r.status === "APPROVED_WITH_NOTES",
      );
    }
    return reports.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  const reportSortAccessors = useMemo(
    () => ({
      reportNumber: (r: HistoryReport) => r.reportNumber,
      date: (r: HistoryReport) => r.reportDate,
      submittedBy: (r: HistoryReport) => r.submittedBy.name,
      status: (r: HistoryReport) => r.status,
      lines: (r: HistoryReport) => r.lineCount,
    }),
    [],
  );

  const reportsTable = useAdminTable({
    rows: filteredReports,
    getSearchText: (r) =>
      `${r.reportNumber} ${r.reportDate} ${r.submittedBy.name} ${r.status}`,
    sortAccessors: reportSortAccessors,
    defaultSort: { key: "date", direction: "desc" },
  });

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading project approvals…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-3">
        <Button asChild variant="outline" size="sm">
          <Link to={`/${base}/approvals`}>
            <ArrowLeft className="size-4" /> Approvals
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button asChild variant="outline" size="sm">
        <Link to={`/${base}/approvals`}>
          <ArrowLeft className="size-4" /> All approvals
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.jobNumber}
        </h1>
        <p className="text-sm text-muted-foreground">{project.name}</p>
        {(project.clientName || project.location) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {[project.clientName, project.location].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ALL", "All"],
            ["SUBMITTED", "Pending"],
            ["RETURNED", "Returned"],
            ["APPROVED", "Approved"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={statusFilter === value ? "default" : "outline"}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <AdminTableSearch
        className="max-w-sm"
        value={reportsTable.searchInput}
        onChange={reportsTable.setSearchInput}
        placeholder="Search reports…"
      />

      {reportsTable.total === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No reports match your filters.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <SortableTh label="Report #" sortKey="reportNumber" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} />
                <SortableTh label="Date" sortKey="date" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} />
                <SortableTh label="Submitted by" sortKey="submittedBy" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} />
                <SortableTh label="Status" sortKey="status" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} />
                <SortableTh label="Lines" sortKey="lines" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} align="right" />
                <th className="px-2 py-1 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {reportsTable.paginated.items.map((r) => {
                const label =
                  frdStatusLabels[r.status as keyof typeof frdStatusLabels] ??
                  r.status.replaceAll("_", " ");
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-2 py-1 font-mono text-xs">{r.reportNumber}</td>
                    <td className="px-2 py-1 tabular-nums text-xs">{r.reportDate}</td>
                    <td className="px-2 py-1 text-xs">{r.submittedBy.name}</td>
                    <td className="px-2 py-1">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          statusStyles[r.status] ?? "bg-muted",
                        )}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.lineCount}</td>
                    <td className="px-2 py-1 text-right">
                      {r.status === "SUBMITTED" ? (
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/${base}/approvals/reports/${r.id}`}>
                            Review
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePagination
            page={reportsTable.paginated.page}
            pageSize={ADMIN_PAGE_SIZE}
            total={reportsTable.paginated.total}
            onPageChange={reportsTable.setPage}
          />
        </div>
      )}
    </div>
  );
}
