import { useEffect, useState } from "react";
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

export function ApprovalsHistoryPage() {
  const [projects, setProjects] = useState<HistoryProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [reports, setReports] = useState<HistoryReport[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
      setReports([]);
      return;
    }
    void (async () => {
      setLoadingHistory(true);
      try {
        const data = await apiFetch<{ reports: HistoryReport[] }>(
          `/api/v1/approvals/history?projectId=${encodeURIComponent(projectId)}`,
        );
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Project report history
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submitted, returned, and approved reports for a project.
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No project history in your scope yet.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <label htmlFor="history-project" className="text-xs font-medium">
              Project
            </label>
            <select
              id="history-project"
              className="flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jobNumber} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {loadingHistory ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading history…
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            <ul className="space-y-2">
              {reports.map((r) => {
                const label =
                  frdStatusLabels[r.status as keyof typeof frdStatusLabels] ??
                  r.status.replaceAll("_", " ");
                return (
                  <li key={r.id}>
                    <Link
                      to={
                        r.status === "SUBMITTED"
                          ? `/approvals/${r.id}`
                          : `/approvals/history`
                      }
                      className={cn(
                        "block rounded-lg border border-border bg-card px-4 py-3 shadow-sm",
                        r.status === "SUBMITTED" &&
                          "hover:border-sky-300 hover:bg-sky-50/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">
                            {r.reportNumber}
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {r.submittedBy.name} · {r.reportDate}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.lineCount} line
                            {r.lineCount === 1 ? "" : "s"}
                            {r.approvedBy
                              ? ` · Approved by ${r.approvedBy.name}`
                              : ""}
                          </p>
                          {r.returnComment && (
                            <p className="mt-1 text-xs text-amber-900">
                              {r.returnComment}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                              statusStyles[r.status] ?? "bg-muted",
                            )}
                          >
                            {label}
                          </span>
                          {r.status === "SUBMITTED" && (
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              Age {r.ageLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
