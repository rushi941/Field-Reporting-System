import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ReportHistoryCard,
  type ReportHistoryCardData,
} from "@/components/report-history-card";
import { MobileProjectPicker } from "@/components/mobile-project-picker";

type RollupProject = {
  id: string;
  jobNumber: string;
  name: string;
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  returnedCount: number;
};

type HistoryReport = ReportHistoryCardData & {
  project: { id: string; jobNumber: string; name: string };
};

type StatusFilter = "all" | "pending" | "approved" | "returned";

const ALL_PROJECTS = "";

export function WorkspaceApprovalHistoryPage({
  base,
}: {
  base: "office" | "system";
}) {
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get("projectId") ?? ALL_PROJECTS;

  const [projects, setProjects] = useState<RollupProject[]>([]);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reports, setReports] = useState<HistoryReport[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    approved: 0,
    returned: 0,
  });
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
        const data = await apiFetch<{ projects: RollupProject[] }>(
          "/api/v1/workspace-reports/rollup",
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
        const params = new URLSearchParams();
        if (projectId) params.set("projectId", projectId);
        if (statusFilter !== "all") params.set("status", statusFilter);
        const data = await apiFetch<{
          counts: typeof counts;
          reports: HistoryReport[];
        }>(`/api/v1/workspace-reports/history?${params.toString()}`);
        setReports(data.reports);
        setCounts(data.counts);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load history",
        );
        setReports([]);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [projectId, statusFilter]);

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
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          View only
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Approval history
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track pending, approved, and returned field reports for your projects.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CountTile label="All" value={counts.all} />
        <CountTile label="Under review" value={counts.pending} warn />
        <CountTile label="Approved" value={counts.approved} ok />
        <CountTile label="Returned" value={counts.returned} warn />
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
              reportCount: p.totalCount,
            }))}
            onChange={setProjectId}
          />

          {selectedProject && (
            <div className="min-w-0 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="break-words font-semibold leading-snug">
                {selectedProject.jobNumber} — {selectedProject.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedProject.approvedCount} approved ·{" "}
                {selectedProject.pendingCount} under review ·{" "}
                {selectedProject.returnedCount} returned
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              All ({counts.all})
            </FilterChip>
            <FilterChip
              active={statusFilter === "pending"}
              onClick={() => setStatusFilter("pending")}
            >
              Under review ({counts.pending})
            </FilterChip>
            <FilterChip
              active={statusFilter === "approved"}
              onClick={() => setStatusFilter("approved")}
            >
              Approved ({counts.approved})
            </FilterChip>
            <FilterChip
              active={statusFilter === "returned"}
              onClick={() => setStatusFilter("returned")}
            >
              Returned ({counts.returned})
            </FilterChip>
          </div>

          {loadingHistory ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading reports…
            </div>
          ) : reports.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              {statusFilter === "all"
                ? showAllProjects
                  ? "No submitted reports yet."
                  : "No submitted reports for this project yet."
                : `No ${statusFilter === "pending" ? "under review" : statusFilter} reports.`}
            </p>
          ) : (
            <ul className="min-w-0 space-y-2.5">
              {reports.map((r) => (
                <li key={r.id}>
                  <ReportHistoryCard
                    report={r}
                    showProject={showAllProjects}
                    linkTo={`/${base}/reports/${r.project.id}/${r.id}`}
                  />
                </li>
              ))}
            </ul>
          )}

          <p className="text-center text-xs text-muted-foreground">
            <Link to={`/${base}/reports`} className="text-sky-800 hover:underline">
              Project report rollup
            </Link>
            {" · "}
            View-only — division managers approve or return reports
          </p>
        </>
      )}
    </div>
  );
}

function CountTile({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: number;
  ok?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        ok && value > 0 && "border-emerald-200 bg-emerald-50/50",
        warn && value > 0 && "border-amber-200 bg-amber-50/50",
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
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
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-sky-300 bg-sky-50 text-sky-950"
          : "border-border bg-card text-muted-foreground hover:bg-muted/50",
      )}
    >
      {children}
    </button>
  );
}
