import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Loader2, Users } from "lucide-react";
import { updateDraftReportSchema } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldTask = {
  id: string;
  division: string;
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

const formLabels: Record<string, string> = {
  STA_RANGE: "STA Range",
  SINGLE_LOCATION: "Single Loc.",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function FieldProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
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
      const data = await apiFetch<{ projects: FieldProject[] }>(
        "/api/v1/field/projects",
      );
      const found = data.projects.find((p) => p.id === projectId) ?? null;
      setProject(found);
      if (!found) {
        toast.error("Project not found");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when project changes
  }, [projectId]);

  const pendingByTask = useMemo(() => {
    return report?.totalsByTask ?? {};
  }, [report]);

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
    <div className="space-y-4 pb-8">
      <Link
        to="/field/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Projects
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{project.jobNumber}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
            {project.division === "PAVEMENT_MARKING"
              ? "PM"
              : project.division === "TRAFFIC_CONTROL"
                ? "TC"
                : "PS"}
          </span>
        </div>
        <h1 className="mt-1 text-lg font-semibold leading-snug">
          {project.name}
          {project.location ? ` — ${project.location}` : ""}
        </h1>
        {(project.clientName || project.generalContractor) && (
          <p className="mt-1 text-xs text-muted-foreground">
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="report-date">
            Report date
          </Label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="report-date"
              type="date"
              className={cn("h-11 pl-9", dateError && "border-destructive")}
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
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="crew-size">
            Crew size
          </Label>
          <div className="relative">
            <Users className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="crew-size"
              type="number"
              min={1}
              className={cn("h-11 pl-9", crewError && "border-destructive")}
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

      <p className="text-xs text-muted-foreground">
        Tap a task to enter quantities, then save or submit for approval from
        the task screen.
      </p>

      <ul className="space-y-2">
        {project.tasks.map((t, idx) => {
          const pending = pendingByTask[t.id] ?? 0;
          const formLabel =
            formLabels[t.taskMaster.formType] ?? t.taskMaster.formType;
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={!editable || busy}
                onClick={() =>
                  navigate(
                    `/field/projects/${project.id}/tasks/${t.id}${
                      report ? `?reportId=${report.id}` : ""
                    }`,
                  )
                }
                className={cn(
                  "w-full rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm transition",
                  editable
                    ? "hover:border-sky-300 hover:bg-sky-50/40"
                    : "opacity-70",
                  busy && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{String(idx + 1).padStart(4, "0")}
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
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <span>
                    Unit:{" "}
                    <strong className="text-foreground">
                      {t.taskMaster.unit}
                    </strong>
                  </span>
                  <span>
                    Today:{" "}
                    <strong className="text-amber-700">
                      {pending.toLocaleString()}
                    </strong>
                  </span>
                </div>
                {pending > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-1/2 rounded-full bg-sky-600" />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      On today&apos;s draft report
                    </p>
                  </div>
                )}
              </button>
            </li>
          );
        })}
        {project.tasks.length === 0 && (
          <li className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No tasks assigned to you on this project.
          </li>
        )}
      </ul>

      {report && !editable && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">
          Report {report.reportNumber} is {report.status.toLowerCase()} and
          locked.
        </p>
      )}
    </div>
  );
}
