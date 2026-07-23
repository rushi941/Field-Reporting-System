import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { frdStatusLabels } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type HistoryProject = {
  id: string;
  jobNumber: string;
  name: string;
  location: string | null;
  clientName?: string | null;
  division?: string;
  taskCount?: number;
  reportCount?: number;
};

type HistoryTask = {
  id: string;
  division: string;
  sortOrder: number;
  assignedTo: { id: string; name: string; email: string } | null;
  taskMaster: {
    id: string;
    code: string;
    name: string;
    unit: string;
    formType: string;
    color: string | null;
    widthInches: number | null;
    conversionFactor: number | null;
  };
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

const formLabels: Record<string, string> = {
  STA_RANGE: "STA Range",
  SINGLE_LOCATION: "Single Loc.",
};

export function ApprovalsHistoryPage() {
  const [projects, setProjects] = useState<HistoryProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState<HistoryTask[]>([]);
  const [reports, setReports] = useState<HistoryReport[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ projects: HistoryProject[] }>(
          "/api/v1/approvals/projects",
        );
        setProjects(data.projects);
        if (data.projects[0]) setProjectId(data.projects[0].id);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load projects",
        );
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      setReports([]);
      return;
    }
    void (async () => {
      setLoadingHistory(true);
      try {
        const data = await apiFetch<{
          tasks: HistoryTask[];
          reports: HistoryReport[];
        }>(
          `/api/v1/approvals/history?projectId=${encodeURIComponent(projectId)}`,
        );
        setTasks(data.tasks ?? []);
        setReports(data.reports);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load history",
        );
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [projectId]);

  if (loadingProjects) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Project report history
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse all projects in your scope, view assigned tasks, and report
          history.
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No active projects in your scope yet.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <label htmlFor="history-project" className="text-xs font-medium">
              Project
            </label>
            <select
              id="history-project"
              className="flex h-11 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jobNumber} — {p.name}
                  {p.taskCount != null ? ` (${p.taskCount} tasks)` : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-semibold">
                {selectedProject.jobNumber} — {selectedProject.name}
              </p>
              {(selectedProject.clientName || selectedProject.location) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[selectedProject.clientName, selectedProject.location]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {tasks.length} task{tasks.length === 1 ? "" : "s"} ·{" "}
                {reports.length} report{reports.length === 1 ? "" : "s"}
              </p>
            </div>
          )}

          {loadingHistory ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading project…
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h2 className="text-sm font-semibold">Project tasks</h2>
                {tasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No tasks assigned on this project yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {tasks.map((t, idx) => {
                      const formLabel =
                        formLabels[t.taskMaster.formType] ??
                        t.taskMaster.formType;
                      return (
                        <li
                          key={t.id}
                          className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              #{String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {formLabel}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm font-semibold leading-snug">
                            {t.taskMaster.name}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {t.taskMaster.code}
                            {t.taskMaster.widthInches != null
                              ? ` · ${t.taskMaster.widthInches}"`
                              : ""}
                            {t.taskMaster.conversionFactor != null
                              ? ` · CF ${Number(t.taskMaster.conversionFactor).toFixed(2)}`
                              : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>
                              Unit:{" "}
                              <strong className="text-foreground">
                                {t.taskMaster.unit}
                              </strong>
                            </span>
                            <span>
                              Field lead:{" "}
                              <strong className="text-foreground">
                                {t.assignedTo?.name ?? "—"}
                              </strong>
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold">Report history</h2>
                {reports.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No submitted reports for this project yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {reports.map((r) => {
                      const label =
                        frdStatusLabels[
                          r.status as keyof typeof frdStatusLabels
                        ] ?? r.status.replaceAll("_", " ");
                      return (
                        <li key={r.id}>
                          <Link
                            to={
                              r.status === "SUBMITTED"
                                ? `/approvals/${r.id}`
                                : "#"
                            }
                            className={cn(
                              "block rounded-lg border border-border bg-card px-4 py-3 shadow-sm",
                              r.status === "SUBMITTED" &&
                                "hover:border-sky-300 hover:bg-sky-50/40",
                            )}
                            onClick={
                              r.status === "SUBMITTED"
                                ? undefined
                                : (e) => e.preventDefault()
                            }
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                                {r.reportNumber}
                              </p>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-none",
                                  statusStyles[r.status] ?? "bg-muted",
                                )}
                              >
                                {label}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium">
                              {r.submittedBy.name} · {r.reportDate}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {r.lineCount} line{r.lineCount === 1 ? "" : "s"}
                              {r.approvedBy
                                ? ` · Approved by ${r.approvedBy.name}`
                                : ""}
                              {r.status === "SUBMITTED"
                                ? ` · Age ${r.ageLabel}`
                                : ""}
                            </p>
                            {r.returnComment && (
                              <p className="mt-2 break-words rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                                {r.returnComment}
                              </p>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
