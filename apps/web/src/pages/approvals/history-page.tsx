import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  ReportHistoryCard,
  type ReportHistoryCardData,
} from "@/components/report-history-card";
import { MobileProjectPicker } from "@/components/mobile-project-picker";

type HistoryProject = {
  id: string;
  jobNumber: string;
  name: string;
  location: string | null;
  clientName?: string | null;
  taskCount?: number;
  reportCount?: number;
};

type HistoryReport = ReportHistoryCardData & {
  ageLabel: string;
  approvalNotes: string | null;
};

const ALL_PROJECTS = "";

export function ApprovalsHistoryPage() {
  const [projects, setProjects] = useState<HistoryProject[]>([]);
  const [projectId, setProjectId] = useState(ALL_PROJECTS);
  const [reports, setReports] = useState<HistoryReport[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const showAllProjects = projectId === ALL_PROJECTS;

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ projects: HistoryProject[] }>(
          "/api/v1/approvals/projects",
        );
        setProjects(data.projects);
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
    void (async () => {
      setLoadingHistory(true);
      try {
        const url = projectId
          ? `/api/v1/approvals/history?projectId=${encodeURIComponent(projectId)}`
          : "/api/v1/approvals/history";
        const data = await apiFetch<{ reports: HistoryReport[] }>(url);
        setReports(data.reports);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load history",
        );
        setReports([]);
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
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Project report history
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {showAllProjects
            ? "All submitted reports across your projects."
            : "Reports for the selected project."}
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No active projects in your scope yet.
        </p>
      ) : (
        <>
          <MobileProjectPicker
            label="Project"
            value={projectId}
            allValue={ALL_PROJECTS}
            allLabel="All projects"
            options={projects.map((p) => ({
              id: p.id,
              jobNumber: p.jobNumber,
              name: p.name,
              reportCount: p.reportCount,
            }))}
            onChange={setProjectId}
          />

          {selectedProject && (
            <div className="min-w-0 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="break-words font-semibold leading-snug">
                {selectedProject.jobNumber} — {selectedProject.name}
              </p>
              {(selectedProject.clientName || selectedProject.location) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[selectedProject.clientName, selectedProject.location]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          )}

          {loadingHistory ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading reports…
            </div>
          ) : reports.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              {showAllProjects
                ? "No submitted reports in your scope yet."
                : "No submitted reports for this project yet."}
            </p>
          ) : (
            <ul className="min-w-0 space-y-2.5">
              {reports.map((r) => (
                <li key={r.id}>
                  <ReportHistoryCard
                    report={r}
                    showProject={showAllProjects}
                    linkTo={`/approvals/${r.id}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
