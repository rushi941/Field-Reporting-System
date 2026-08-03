import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Loader2, Users } from "lucide-react";
import { formTypeLabel, updateDraftReportSchema } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/auth/auth-context";
import { markFieldTasksKnown } from "@/lib/activity-seen";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaskProgressBar } from "@/components/task-progress-bar";
import { cn } from "@/lib/utils";

type FieldTask = {
  id: string;
  division: string;
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  isMine: boolean;
  completedStaRanges: { beginSta: string; endSta: string; reportNumber: string }[];
  usesSymbolEntry?: boolean;
  progress: {
    estimated: number;
    approved: number;
    pending: number;
    approvedPct: number;
  };
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

type FieldProject = {
  id: string;
  jobNumber: string;
  name: string;
  location: string | null;
  clientName: string | null;
  generalContractor: string | null;
  division: string;
  tasks: FieldTask[];
  route: {
    beginSta: string | null;
    endSta: string | null;
    label: string | null;
  } | null;
};

type FieldReport = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  crewSize: number | null;
  notes: string | null;
  returnComment: string | null;
  totalsByTask: Record<string, number>;
  lineItems: { projectTaskId: string; finalQuantity: number }[];
};

function taskFormLabel(task: FieldTask): string {
  if (task.usesSymbolEntry) return "Symbols";
  return formTypeLabel(task.taskMaster.formType);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function FieldProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<FieldProject | null>(null);
  const [report, setReport] = useState<FieldReport | null>(null);
  const [reportDate, setReportDate] = useState(todayIso());
  const [crewSize, setCrewSize] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [crewError, setCrewError] = useState<string | undefined>();
  const [dateError, setDateError] = useState<string | undefined>();

  function parseMeta(nextDate = reportDate, nextCrew = crewSize) {
    const crewRaw = nextCrew.trim();
    const parsed = updateDraftReportSchema.safeParse({
      reportDate: nextDate.trim(),
      crewSize:
        crewRaw === ""
          ? null
          : Number.isFinite(Number(crewRaw))
            ? Number(crewRaw)
            : Number.NaN,
    });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setDateError(fieldErrors.reportDate?.[0]);
      setCrewError(fieldErrors.crewSize?.[0]);
      return null;
    }
    setDateError(undefined);
    setCrewError(undefined);
    return parsed.data;
  }

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ project: FieldProject }>(
        `/api/v1/field/projects/${projectId}`,
      );
      const found = data.project;
      setProject(found);
      if (found) {
        markFieldTasksKnown(
          user?.id,
          found.tasks.map((t) => t.id),
        );
      }
      if (!found) {
        toast.error("Project not found");
        return;
      }
      if (found.tasks.length === 0) {
        setReport(null);
        return;
      }
      const myTasks = found.tasks.filter((t) => t.isMine);
      if (myTasks.length === 0) {
        setReport(null);
        return;
      }
      const draft = await apiFetch<{ report: FieldReport }>(
        "/api/v1/field/reports/draft",
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            reportDate,
          }),
        },
      );
      setReport(draft.report);
      setReportDate(draft.report.reportDate);
      setCrewSize(
        draft.report.crewSize != null ? String(draft.report.crewSize) : "",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when project or user changes
  }, [projectId, user?.id]);

  const myTasks = useMemo(
    () => project?.tasks.filter((t) => t.isMine) ?? [],
    [project],
  );

  const busy = saving;

  async function saveMeta() {
    if (!report) return;
    const meta = parseMeta();
    if (!meta) {
      toast.error("Fix report date or crew size", { id: "field-report" });
      return;
    }
    setSaving(true);
    try {
      const data = await apiFetch<{ report: FieldReport }>(
        `/api/v1/field/reports/${report.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            reportDate: meta.reportDate,
            crewSize: meta.crewSize ?? null,
          }),
        },
      );
      setReport(data.report);
      toast.success("Report details saved", { id: "field-report" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed", {
        id: "field-report",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDateChange(next: string) {
    setReportDate(next);
    setDateError(undefined);
    if (!projectId) return;
    const meta = parseMeta(next, crewSize);
    if (!meta?.reportDate) {
      toast.error("Enter a valid report date", { id: "field-report" });
      return;
    }
    setSaving(true);
    try {
      const draft = await apiFetch<{ report: FieldReport }>(
        "/api/v1/field/reports/draft",
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            reportDate: meta.reportDate,
            crewSize: meta.crewSize ?? null,
          }),
        },
      );
      setReport(draft.report);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load draft");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-3">
        <Link
          to="/field/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Projects
        </Link>
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const editable =
    !report || report.status === "DRAFT" || report.status === "RETURNED";

  return (
    <div className="space-y-3 pb-4">
      <Link
        to="/field/projects"
        className="inline-flex items-center gap-1 text-xs font-medium text-sky-800 hover:text-sky-900"
      >
        <ArrowLeft className="size-4" /> All projects
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold">{project.jobNumber}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
            {project.division === "PAVEMENT_MARKING"
              ? "PM"
              : project.division === "TRAFFIC_CONTROL"
                ? "TC"
                : "PS"}
          </span>
        </div>
        <h1 className="mt-0.5 text-base font-semibold leading-tight">
          {project.name}
          {project.location ? ` — ${project.location}` : ""}
        </h1>
        {(project.clientName || project.generalContractor) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[project.clientName, project.generalContractor]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {report?.status === "RETURNED" && report.returnComment && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Returned for correction</p>
          <p className="mt-1 text-xs">{report.returnComment}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="report-date">
            Report date
          </Label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="report-date"
              type="date"
              className={cn("h-10 pl-9 text-sm", dateError && "border-destructive")}
              value={reportDate}
              disabled={!editable || busy}
              aria-invalid={Boolean(dateError)}
              onChange={(e) => void onDateChange(e.target.value)}
            />
          </div>
          {dateError && (
            <p className="text-[11px] text-destructive" role="alert">
              {dateError}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="crew-size">
            Crew size
          </Label>
          <div className="relative">
            <Users className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="crew-size"
              type="number"
              min={1}
              className={cn("h-10 pl-9 text-sm", crewError && "border-destructive")}
              placeholder="# people"
              value={crewSize}
              disabled={!editable || busy}
              aria-invalid={Boolean(crewError)}
              onChange={(e) => {
                setCrewSize(e.target.value);
                setCrewError(undefined);
              }}
              onBlur={() => void saveMeta()}
            />
          </div>
          {crewError && (
            <p className="text-[11px] text-destructive" role="alert">
              {crewError}
            </p>
          )}
        </div>
      </div>

      {saving && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Saving…
        </p>
      )}

      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {myTasks.length === 0
          ? "No tasks assigned to you on this project yet."
          : "Your assigned tasks are listed below. Tap one to enter quantities and submit."}
      </p>

      <ul className="space-y-2">
        {myTasks.map((t) => {
          const formLabel = taskFormLabel(t);
          const canOpen = editable && !busy;
          const progress = t.progress ?? {
            estimated: 0,
            approved: 0,
            pending: 0,
            approvedPct: 0,
          };
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={!canOpen}
                onClick={() =>
                  canOpen &&
                  navigate(
                    `/field/projects/${project.id}/tasks/${t.id}${
                      report ? `?reportId=${report.id}` : ""
                    }`,
                  )
                }
                className={cn(
                  "w-full rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm transition",
                  canOpen
                    ? "active:scale-[0.99] hover:border-sky-300 hover:bg-sky-50/40"
                    : "opacity-70",
                  busy && canOpen && "opacity-60",
                )}
              >
                <TaskProgressBar
                  code={t.taskMaster.code}
                  name={t.taskMaster.name}
                  formLabel={formLabel}
                  unit={t.taskMaster.unit}
                  estimated={progress.estimated}
                  approved={progress.approved}
                  pending={progress.pending}
                />
              </button>
            </li>
          );
        })}
        {myTasks.length === 0 && (
          <li className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No tasks assigned to you on this project.
          </li>
        )}
      </ul>

      {myTasks.length === 0 && editable && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Ask your project admin to assign tasks to you on this job.
        </p>
      )}

      {report && !editable && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">
          Report {report.reportNumber} is {report.status.toLowerCase()} and
          locked.
        </p>
      )}
    </div>
  );
}
