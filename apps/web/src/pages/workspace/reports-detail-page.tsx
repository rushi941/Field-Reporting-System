import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { frdStatusLabels } from "@frs/shared";
import { apiDownload, apiFetch } from "@/lib/api";
import { workspaceReportsExportPath } from "@/lib/billing-export";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminTableSearch } from "@/components/admin-table-search";
import { SortableTh } from "@/components/sortable-table-head";
import { useAdminTable } from "@/hooks/use-admin-table";

type ProjectInfo = {
  id: string;
  jobNumber: string;
  name: string;
  location: string | null;
  division: string;
  clientName: string | null;
  generalContractor: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  projectAdmin: { name: string; email: string } | null;
  projectManager: { name: string; email: string } | null;
  taskCount: number;
};

type TaskRow = {
  id: string;
  division: string;
  assignedTo: { name: string; email: string } | null;
  taskMaster: {
    code: string;
    name: string;
    unit: string;
    formType: string;
  };
};

type ReportRow = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  lineCount: number;
  attachmentCount: number;
  crewSize: number | null;
  returnComment: string | null;
  approvalNotes: string | null;
  submittedBy: { name: string; email: string };
  approvedBy: { name: string } | null;
  ageLabel: string;
};

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-800",
  SUBMITTED: "bg-sky-100 text-sky-900",
  RETURNED: "bg-amber-100 text-amber-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  APPROVED_WITH_NOTES: "bg-emerald-100 text-emerald-900",
};

export function WorkspaceReportsDetailPage({
  base,
}: {
  base: "office" | "system";
}) {
  const { projectId } = useParams();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [statusCounts, setStatusCounts] = useState({
    draft: 0,
    pending: 0,
    returned: 0,
    approved: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const taskSortAccessors = useMemo(
    () => ({
      code: (t: TaskRow) => t.taskMaster.code,
      name: (t: TaskRow) => t.taskMaster.name,
      unit: (t: TaskRow) => t.taskMaster.unit,
      lead: (t: TaskRow) => t.assignedTo?.name ?? "",
    }),
    [],
  );

  const reportSortAccessors = useMemo(
    () => ({
      reportNumber: (r: ReportRow) => r.reportNumber,
      date: (r: ReportRow) => r.reportDate,
      submittedBy: (r: ReportRow) => r.submittedBy.name,
      status: (r: ReportRow) => r.status,
      lines: (r: ReportRow) => r.lineCount,
      photos: (r: ReportRow) => r.attachmentCount,
    }),
    [],
  );

  const tasksTable = useAdminTable({
    rows: tasks,
    getSearchText: (t) =>
      `${t.taskMaster.code} ${t.taskMaster.name} ${t.assignedTo?.name ?? ""}`,
    sortAccessors: taskSortAccessors,
    defaultSort: { key: "code", direction: "asc" },
  });

  const reportsTable = useAdminTable({
    rows: reports,
    getSearchText: (r) =>
      `${r.reportNumber} ${r.reportDate} ${r.submittedBy.name} ${r.status}`,
    sortAccessors: reportSortAccessors,
    defaultSort: { key: "date", direction: "desc" },
  });

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{
          project: ProjectInfo;
          tasks: TaskRow[];
          reports: ReportRow[];
          statusCounts: typeof statusCounts;
        }>(`/api/v1/workspace-reports/projects/${projectId}`);
        setProject(data.project);
        setTasks(data.tasks);
        setReports(data.reports);
        setStatusCounts(data.statusCounts);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load project reports");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  async function downloadReports() {
    if (!project) return;
    setExporting(true);
    try {
      await apiDownload(
        workspaceReportsExportPath(project.id),
        `${project.jobNumber}-project-reports.csv`,
      );
      toast.success("Project reports CSV downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading project reports…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to={`/${base}/reports`}>
            <ArrowLeft className="size-4" /> Back to reports
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-3">
            <Link to={`/${base}/reports`}>
              <ArrowLeft className="size-4" /> All projects
            </Link>
          </Button>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Project reports
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {project.jobNumber}
          </h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/${base}/projects/${project.id}`}>Project setup</Link>
          </Button>
          {reports.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => void downloadReports()}
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download CSV
            </Button>
          )}
          {statusCounts.approved > 0 && (
            <Button asChild size="sm">
              <Link to={`/${base}/billing/${project.id}`}>Billing drilldown</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {project.clientName && (
            <span>
              Client: <strong className="text-foreground">{project.clientName}</strong>
            </span>
          )}
          {project.location && (
            <span>
              Location: <strong className="text-foreground">{project.location}</strong>
            </span>
          )}
          {project.projectAdmin && (
            <span>
              Project admin:{" "}
              <strong className="text-foreground">{project.projectAdmin.name}</strong>
            </span>
          )}
          {project.projectManager && (
            <span>
              Manager:{" "}
              <strong className="text-foreground">{project.projectManager.name}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <CountCard label="Total reports" value={statusCounts.total} />
        <CountCard label="Approved" value={statusCounts.approved} />
        <CountCard label="Under review" value={statusCounts.pending} warn />
        <CountCard label="Returned" value={statusCounts.returned} warn />
        <CountCard label="Draft" value={statusCounts.draft} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Project tasks ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No tasks on this project yet.
          </p>
        ) : (
          <>
            <AdminTableSearch
              className="max-w-sm"
              value={tasksTable.searchInput}
              onChange={tasksTable.setSearchInput}
              placeholder="Search tasks…"
            />
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <SortableTh label="Code" sortKey="code" activeSortKey={tasksTable.sortKey} sortDir={tasksTable.sortDir} onSort={tasksTable.toggleSort} />
                  <SortableTh label="Task" sortKey="name" activeSortKey={tasksTable.sortKey} sortDir={tasksTable.sortDir} onSort={tasksTable.toggleSort} />
                  <SortableTh label="Unit" sortKey="unit" activeSortKey={tasksTable.sortKey} sortDir={tasksTable.sortDir} onSort={tasksTable.toggleSort} />
                  <SortableTh label="Field lead" sortKey="lead" activeSortKey={tasksTable.sortKey} sortDir={tasksTable.sortDir} onSort={tasksTable.toggleSort} />
                </tr>
              </thead>
              <tbody>
                {tasksTable.total === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No tasks match your search.
                    </td>
                  </tr>
                )}
                {tasksTable.paginated.items.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-2 py-1 font-mono text-xs">{t.taskMaster.code}</td>
                    <td className="px-2 py-1">{t.taskMaster.name}</td>
                    <td className="px-2 py-1">{t.taskMaster.unit}</td>
                    <td className="px-2 py-1 text-xs">
                      {t.assignedTo?.name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Field reports</h2>
        {reports.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No field reports on this project yet.
          </p>
        ) : (
          <>
            <AdminTableSearch
              className="max-w-sm"
              value={reportsTable.searchInput}
              onChange={reportsTable.setSearchInput}
              placeholder="Search reports…"
            />
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <SortableTh label="Report #" sortKey="reportNumber" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} />
                  <SortableTh label="Date" sortKey="date" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} />
                  <SortableTh label="Submitted by" sortKey="submittedBy" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} />
                  <SortableTh label="Status" sortKey="status" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} />
                  <SortableTh label="Lines" sortKey="lines" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} align="right" />
                  <SortableTh label="Photos" sortKey="photos" activeSortKey={reportsTable.sortKey} sortDir={reportsTable.sortDir} onSort={reportsTable.toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {reportsTable.total === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No reports match your search.
                    </td>
                  </tr>
                )}
                {reportsTable.paginated.items.map((r) => {
                  const label =
                    frdStatusLabels[
                      r.status as keyof typeof frdStatusLabels
                    ] ?? r.status.replaceAll("_", " ");
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-1 font-mono text-xs">{r.reportNumber}</td>
                      <td className="px-2 py-1 tabular-nums">{r.reportDate}</td>
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
                        {r.status === "SUBMITTED" && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            {r.ageLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {r.lineCount}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {r.attachmentCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      {reports.some((r) => r.returnComment || r.approvalNotes) && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Notes & comments</h2>
          <ul className="space-y-2">
            {reports
              .filter((r) => r.returnComment || r.approvalNotes)
              .map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border bg-card px-4 py-3 text-sm"
                >
                  <p className="font-mono text-xs text-muted-foreground">
                    {r.reportNumber} · {r.reportDate}
                  </p>
                  {r.returnComment && (
                    <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                      Return: {r.returnComment}
                    </p>
                  )}
                  {r.approvalNotes && (
                    <p className="mt-1 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
                      Approval: {r.approvalNotes}
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CountCard({
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
