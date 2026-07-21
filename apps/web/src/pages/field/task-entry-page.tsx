import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import {
  attachmentUploadMeta,
  normalizeSta,
  reportedLfFromSta,
  updateDraftReportSchema,
  validateAttachmentFile,
  validateReportTaskSegments,
  type SegmentFieldErrors,
} from "@frs/shared";
import { ConnectionBanner } from "@/components/connection-banner";
import { apiFetch, apiUpload } from "@/lib/api";
import { cacheGet, OFFLINE_CACHE_KEYS } from "@/lib/offline-cache";
import {
  clearTaskEntryDraft,
  loadTaskEntryDraft,
  saveTaskEntryDraft,
} from "@/lib/task-entry-draft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";

type TaskMaster = {
  id: string;
  code: string;
  name: string;
  unit: string;
  formType: string;
  color: string | null;
  widthInches: number | null;
  conversionFactor: number | null;
};

type ProjectInfo = {
  id: string;
  jobNumber: string;
  name: string;
  location: string | null;
  tasks: {
    id: string;
    taskMaster: TaskMaster;
  }[];
};

type FieldReport = {
  id: string;
  reportNumber: string;
  notes: string | null;
  status: string;
  lineItems: {
    id: string;
    projectTaskId: string;
    entryType: string;
    beginSta: string | null;
    endSta: string | null;
    conversionFactor: number | null;
    calculatedLf: number | null;
    manualLf: number | null;
    finalQuantity: number;
    locationDescription: string | null;
    symbolItemType: string | null;
  }[];
  attachments: {
    id: string;
    fileName: string;
    category: string;
    storageUrl?: string;
    fileType?: string;
  }[];
};

type StaSeg = {
  beginSta: string;
  endSta: string;
  conversionFactor: string;
  useManualLf: boolean;
  manualLf: string;
};

type LocSeg = {
  locationDescription: string;
  symbolItemType: string;
  quantity: string;
};

const formLabels: Record<string, string> = {
  STA_RANGE: "STA Range",
  SINGLE_LOCATION: "Single Location",
};

const selectClass =
  "flex h-12 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

const inputClass = "h-12 text-base";

function emptySta(cf: number): StaSeg {
  return {
    beginSta: "",
    endSta: "",
    conversionFactor: Number.isFinite(cf) ? cf.toFixed(2) : "1.00",
    useManualLf: false,
    manualLf: "",
  };
}

function emptyLoc(defaultSymbol = ""): LocSeg {
  return {
    locationDescription: "",
    symbolItemType: defaultSymbol,
    quantity: "",
  };
}

function calcPreview(seg: StaSeg): string {
  if (seg.useManualLf) {
    const n = Number(seg.manualLf);
    return Number.isFinite(n) && n > 0 ? n.toLocaleString() : "—";
  }
  try {
    const cf = Number(seg.conversionFactor);
    if (!seg.beginSta || !seg.endSta || Number.isNaN(cf)) return "—";
    return reportedLfFromSta(
      normalizeSta(seg.beginSta),
      normalizeSta(seg.endSta),
      cf,
    ).toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
}

function TaskMetaBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-snug">{value}</p>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  );
}

function PageLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-6 animate-spin text-sky-800" />
      {label}
    </div>
  );
}

export function FieldTaskEntryPage() {
  const { projectId, taskId } = useParams<{
    projectId: string;
    taskId: string;
  }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const reportIdHint = search.get("reportId");
  const online = useOnlineStatus();
  const [cacheRestored, setCacheRestored] = useState(false);

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [report, setReport] = useState<FieldReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState<string | undefined>();
  const [staSegs, setStaSegs] = useState<StaSeg[]>([emptySta(1)]);
  const [locSegs, setLocSegs] = useState<LocSeg[]>([emptyLoc()]);
  const [segErrors, setSegErrors] = useState<SegmentFieldErrors>({});
  const [uploading, setUploading] = useState(false);
  const [attachCategory, setAttachCategory] = useState("PHOTO");
  const [attachError, setAttachError] = useState<string | undefined>();
  /** Editable defaults prefilled from the project task */
  const [defaultCf, setDefaultCf] = useState("1.00");
  const [defaultCfError, setDefaultCfError] = useState<string | undefined>();
  const [defaultSymbol, setDefaultSymbol] = useState("");
  const [defaultUnit, setDefaultUnit] = useState("LF");

  const task = useMemo(
    () => project?.tasks.find((t) => t.id === taskId) ?? null,
    [project, taskId],
  );

  const isSta = task?.taskMaster.formType === "STA_RANGE";
  const editable =
    report?.status === "DRAFT" || report?.status === "RETURNED";
  const busy = saving || uploading || submitting;

  const reportTotal = useMemo(() => {
    if (isSta) {
      return staSegs.reduce((sum, s) => {
        const preview = calcPreview(s);
        const n = Number(String(preview).replace(/,/g, ""));
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
    }
    return locSegs.reduce((sum, s) => {
      const n = Number(s.quantity);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [isSta, staSegs, locSegs]);

  // Auto-save an offline draft to the phone so slow/offline connections never lose input.
  useEffect(() => {
    if (!projectId || !taskId) return;
    if (!editable) return;
    if (loading) return;
    if (busy) return;
    const timer = window.setTimeout(() => {
      saveTaskEntryDraft(projectId, taskId, {
        notes,
        staSegs,
        locSegs,
        defaultCf,
        defaultSymbol,
        defaultUnit,
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    projectId,
    taskId,
    editable,
    loading,
    busy,
    notes,
    staSegs,
    locSegs,
    defaultCf,
    defaultSymbol,
    defaultUnit,
  ]);

  useEffect(() => {
    if (!projectId || !taskId) return;
    void (async () => {
      setLoading(true);
      try {
        setCacheRestored(false);

        const cachedProjects =
          cacheGet<{ projects: ProjectInfo[] }>(OFFLINE_CACHE_KEYS.fieldProjects)
            ?.data ?? null;

        let projectsData: { projects: ProjectInfo[] } | null = null;
        if (online) {
          try {
            projectsData = await apiFetch<{ projects: ProjectInfo[] }>(
              "/api/v1/field/projects",
            );
          } catch {
            // fall back to cache
          }
        }
        if (!projectsData && cachedProjects) {
          projectsData = cachedProjects;
          setCacheRestored(true);
        }
        if (!projectsData) throw new Error("Failed to load project data");

        const found =
          projectsData.projects.find((p) => p.id === projectId) ?? null;
        setProject(found);
        const foundTask = found?.tasks.find((t) => t.id === taskId);
        if (!found || !foundTask) {
          toast.error("Task not found");
          return;
        }

        let reportData: FieldReport | null = null;
        if (online) {
          try {
            if (reportIdHint) {
              const r = await apiFetch<{ report: FieldReport }>(
                `/api/v1/field/reports/${reportIdHint}`,
              );
              reportData = r.report;
            } else {
              const r = await apiFetch<{ report: FieldReport }>(
                "/api/v1/field/reports/draft",
                {
                  method: "POST",
                  body: JSON.stringify({
                    projectId,
                    reportDate: new Date().toISOString().slice(0, 10),
                  }),
                },
              );
              reportData = r.report;
            }
          } catch {
            // fall back to local stub report
          }
        }

        if (!reportData) {
          reportData = {
            id: reportIdHint ?? `local-${projectId}-${taskId}`,
            reportNumber: "LOCAL",
            notes: null,
            status: "DRAFT",
            lineItems: [],
            attachments: [],
          };
          setCacheRestored(true);
        }

        setReport(reportData);
        setNotes(reportData.notes ?? "");

        const existing = reportData.lineItems.filter(
          (li) => li.projectTaskId === taskId,
        );
        const cf = Number(foundTask.taskMaster.conversionFactor ?? 1);
        const symbolDefault = foundTask.taskMaster.name;
        setDefaultCf(Number.isFinite(cf) ? cf.toFixed(2) : "1.00");
        setDefaultSymbol(symbolDefault);
        setDefaultUnit(foundTask.taskMaster.unit || "LF");

        const isStaLocal = foundTask.taskMaster.formType === "STA_RANGE";

        if (isStaLocal) {
          if (existing.length) {
            setStaSegs(
              existing.map((li) => ({
                beginSta: li.beginSta ?? "",
                endSta: li.endSta ?? "",
                conversionFactor: String(li.conversionFactor ?? cf),
                useManualLf: li.entryType === "MANUAL_FOOTAGE",
                manualLf: li.manualLf != null ? String(li.manualLf) : "",
              })),
            );
          } else {
            setStaSegs([emptySta(cf)]);
          }
        } else if (existing.length) {
          setLocSegs(
            existing.map((li) => ({
              locationDescription: li.locationDescription ?? "",
              symbolItemType: li.symbolItemType || symbolDefault,
              quantity: String(li.finalQuantity),
            })),
          );
        } else {
          setLocSegs([emptyLoc(symbolDefault)]);
        }

        // Restore unsent task draft from this device
        const draft = loadTaskEntryDraft(projectId, taskId);
        if (draft) {
          setCacheRestored(true);
          setNotes(draft.notes ?? "");
          setDefaultCf(draft.defaultCf ?? cf.toFixed(2));
          setDefaultSymbol(draft.defaultSymbol ?? symbolDefault);
          setDefaultUnit(draft.defaultUnit ?? foundTask.taskMaster.unit ?? "LF");
          if (isStaLocal && draft.staSegs?.length) setStaSegs(draft.staSegs as StaSeg[]);
          if (!isStaLocal && draft.locSegs?.length)
            setLocSegs(draft.locSegs as LocSeg[]);
          toast.message("Draft restored from this device", { id: "task-draft" });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, taskId, reportIdHint, online]);

  function clearSegField(index: number, field: string) {
    setSegErrors((prev) => {
      const row = prev[index];
      if (!row?.[field]) return prev;
      const nextRow = { ...row };
      delete nextRow[field];
      const next = { ...prev };
      if (Object.keys(nextRow).length === 0) delete next[index];
      else next[index] = nextRow;
      return next;
    });
  }

  function updateSta(index: number, patch: Partial<StaSeg>, field?: string) {
    setStaSegs((rows) =>
      rows.map((r, idx) => (idx === index ? { ...r, ...patch } : r)),
    );
    if (field) clearSegField(index, field);
  }

  function updateLoc(index: number, patch: Partial<LocSeg>, field?: string) {
    setLocSegs((rows) =>
      rows.map((r, idx) => (idx === index ? { ...r, ...patch } : r)),
    );
    if (field) clearSegField(index, field);
  }

  /** Validate + PUT task lines (and notes). Returns updated report or null. */
  async function persistTask(): Promise<FieldReport | null> {
    if (!report || !task || !editable) return null;

    const notesParsed = updateDraftReportSchema.safeParse({
      notes: notes.trim() ? notes.trim() : null,
    });
    if (!notesParsed.success) {
      const msg = notesParsed.error.issues[0]?.message ?? "Invalid notes";
      setNotesError(msg);
      toast.error(msg, { id: "field-entry" });
      return null;
    }
    setNotesError(undefined);

    const rawSegments: unknown[] = isSta
      ? staSegs.map(
          (s): Record<string, unknown> => ({
            beginSta: s.beginSta.trim(),
            endSta: s.endSta.trim(),
            conversionFactor: Number(s.conversionFactor),
            useManualLf: s.useManualLf,
            manualLf: s.useManualLf
              ? s.manualLf.trim() === ""
                ? null
                : Number(s.manualLf)
              : null,
          }),
        )
      : locSegs.map((s) => ({
          locationDescription: s.locationDescription.trim(),
          symbolItemType: s.symbolItemType.trim(),
          quantity:
            s.quantity.trim() === "" ? Number.NaN : Number(s.quantity),
        }));

    const validated = validateReportTaskSegments(
      isSta ? "STA_RANGE" : "SINGLE_LOCATION",
      rawSegments,
    );
    if (!validated.success) {
      setSegErrors(validated.errors);
      toast.error(validated.message, { id: "field-entry" });
      return null;
    }
    setSegErrors({});

    if (notes !== (report.notes ?? "")) {
      await apiFetch(`/api/v1/field/reports/${report.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: notesParsed.data.notes ?? null }),
      });
    }

    const data = await apiFetch<{ report: FieldReport }>(
      `/api/v1/field/reports/${report.id}/tasks/${task.id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          segments: validated.segments,
        }),
      },
    );
    setReport(data.report);
    return data.report;
  }

  async function saveToReport() {
    if (!report || !task || !editable) return;
    setSaving(true);
    try {
      const saved = await persistTask();
      if (!saved) return;
      toast.success("Saved to report", { id: "field-entry" });
      clearTaskEntryDraft(projectId, taskId);
      navigate(`/field/projects/${projectId}`);
    } catch (err) {
      if (!online) {
        toast.message(
          "Saved locally on this device. Connect and try again to sync.",
          { id: "field-entry" },
        );
      } else {
        toast.error(err instanceof Error ? err.message : "Save failed", {
          id: "field-entry",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveAndSubmit() {
    if (!report || !task || !editable) return;
    setSubmitting(true);
    try {
      const saved = await persistTask();
      if (!saved) return;
      if (!saved.lineItems.length) {
        toast.error("Add quantities before submit", { id: "field-entry" });
        return;
      }
      const data = await apiFetch<{ report: FieldReport }>(
        `/api/v1/field/reports/${saved.id}/submit`,
        { method: "POST" },
      );
      setReport(data.report);
      toast.success(`Submitted ${data.report.reportNumber}`, {
        id: "field-entry",
      });
      clearTaskEntryDraft(projectId, taskId);
      navigate("/field/reports");
    } catch (err) {
      if (!online) {
        toast.message(
          "Saved locally on this device. Connect and try again to sync.",
          { id: "field-entry" },
        );
      } else {
        toast.error(err instanceof Error ? err.message : "Submit failed", {
          id: "field-entry",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onUploadFile(fileList: FileList | null) {
    if (!report || !fileList?.length || !editable) return;
    const file = fileList[0];
    const check = validateAttachmentFile(file);
    if (!check.ok) {
      setAttachError(check.message);
      toast.error(check.message, { id: "field-attach" });
      return;
    }
    setAttachError(undefined);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", attachCategory);
      await apiUpload(`/api/v1/field/reports/${report.id}/attachments`, form);
      const refreshed = await apiFetch<{ report: FieldReport }>(
        `/api/v1/field/reports/${report.id}`,
      );
      setReport(refreshed.report);
      toast.success("Attachment uploaded", { id: "field-attach" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", {
        id: "field-attach",
      });
    } finally {
      setUploading(false);
    }
  }

  function applyDefaultCfToSegments() {
    const cf = Number(defaultCf);
    if (Number.isNaN(cf) || cf < 0) {
      setDefaultCfError("Enter a valid conversion factor (≥ 0)");
      toast.error("Enter a valid CF", { id: "field-entry" });
      return;
    }
    setDefaultCfError(undefined);
    setStaSegs((rows) =>
      rows.map((r) => ({ ...r, conversionFactor: cf.toFixed(2) })),
    );
    toast.success("CF applied to segments", { id: "field-entry" });
  }

  if (loading) {
    return <PageLoader label="Loading task…" />;
  }

  if (!project || !task || !report) {
    return (
      <div className="space-y-2">
        <Link
          to={`/field/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
        <p className="text-sm text-muted-foreground">Task not available.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", editable && "pb-36 md:pb-10")}>
      <ConnectionBanner online={online} fromCache={cacheRestored} />
      <Link
        to={`/field/projects/${projectId}`}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-sky-800 hover:text-sky-900"
      >
        <ArrowLeft className="size-5" /> Back to tasks
      </Link>

      <div className="space-y-2">
        <p className="font-mono text-sm font-bold text-sky-900">
          {task.taskMaster.code}
        </p>
        <h1 className="text-base font-semibold leading-snug text-foreground sm:text-lg">
          {task.taskMaster.name}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {project.jobNumber} · {project.name}
          {project.location ? ` · ${project.location}` : ""}
        </p>
        <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
          {isSta
            ? "Add one row per line segment. All rows save together under this task."
            : "Add each location and quantity for this task."}
        </p>
        {!editable && (
          <p className="rounded-lg border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            Report is {report.status.replaceAll("_", " ").toLowerCase()} and
            locked.
          </p>
        )}
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-semibold text-foreground">Task details</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <TaskMetaBadge label="Line code" value={task.taskMaster.code} />
          <TaskMetaBadge
            label="Form"
            value={
              formLabels[task.taskMaster.formType] ?? task.taskMaster.formType
            }
          />
          <TaskMetaBadge label="Unit" value={defaultUnit || task.taskMaster.unit} />
          <TaskMetaBadge label="Color" value={task.taskMaster.color ?? "—"} />
          <TaskMetaBadge
            label="Width"
            value={
              task.taskMaster.widthInches != null
                ? `${task.taskMaster.widthInches}"`
                : "—"
            }
          />
        </div>

        {isSta && (
          <div className="space-y-2 border-t border-border pt-3">
            <Label className="text-sm" htmlFor="default-cf">
              Conversion factor (all segments)
            </Label>
            <p className="text-xs text-muted-foreground">
              1.0 = single line · 2.0 = double line
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="default-cf"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                disabled={!editable || busy}
                aria-invalid={Boolean(defaultCfError)}
                className={cn(inputClass, "sm:max-w-[140px]", defaultCfError && "border-destructive")}
                value={defaultCf}
                onChange={(e) => {
                  setDefaultCf(e.target.value);
                  setDefaultCfError(undefined);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full sm:w-auto sm:px-6"
                disabled={!editable || busy}
                onClick={applyDefaultCfToSegments}
              >
                Apply to all segments
              </Button>
            </div>
            <FieldError message={defaultCfError} />
          </div>
        )}

        {!isSta && (
          <div className="space-y-2 border-t border-border pt-3">
            <Label className="text-sm" htmlFor="default-symbol">
              Default symbol / item
            </Label>
            <Input
              id="default-symbol"
              disabled={!editable || busy}
              className={inputClass}
              value={defaultSymbol}
              onChange={(e) => setDefaultSymbol(e.target.value)}
            />
          </div>
        )}
      </section>

      {isSta ? (
        <div className="space-y-3">
          {staSegs.map((seg, i) => {
            const err = segErrors[i] ?? {};
            return (
              <div
                key={i}
                className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    Segment {i + 1}
                  </p>
                  {staSegs.length > 1 && editable && (
                    <button
                      type="button"
                      className="text-destructive disabled:opacity-50"
                      disabled={busy}
                      aria-label={`Remove segment ${i + 1}`}
                      onClick={() => {
                        setStaSegs((rows) =>
                          rows.filter((_, idx) => idx !== i),
                        );
                        setSegErrors({});
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm" htmlFor={`begin-${i}`}>
                      Begin STA
                    </Label>
                    <Input
                      id={`begin-${i}`}
                      placeholder="e.g. 1+00"
                      disabled={!editable || busy}
                      aria-invalid={Boolean(err.beginSta)}
                      className={cn(inputClass, err.beginSta && "border-destructive")}
                      value={seg.beginSta}
                      onChange={(e) =>
                        updateSta(i, { beginSta: e.target.value }, "beginSta")
                      }
                    />
                    <FieldError message={err.beginSta} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm" htmlFor={`end-${i}`}>
                      End STA
                    </Label>
                    <Input
                      id={`end-${i}`}
                      placeholder="e.g. 6+00"
                      disabled={!editable || busy}
                      aria-invalid={Boolean(err.endSta)}
                      className={cn(inputClass, err.endSta && "border-destructive")}
                      value={seg.endSta}
                      onChange={(e) =>
                        updateSta(i, { endSta: e.target.value }, "endSta")
                      }
                    />
                    <FieldError message={err.endSta} />
                  </div>
                </div>

                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0"
                    disabled={!editable || busy}
                    checked={seg.useManualLf}
                    onChange={(e) =>
                      updateSta(
                        i,
                        { useManualLf: e.target.checked },
                        "manualLf",
                      )
                    }
                  />
                  Enter footage directly (manual LF)
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm" htmlFor={`cf-${i}`}>
                      Conv. factor
                    </Label>
                    <Input
                      id={`cf-${i}`}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      disabled={!editable || busy}
                      aria-invalid={Boolean(err.conversionFactor)}
                      className={cn(
                        inputClass,
                        err.conversionFactor && "border-destructive",
                      )}
                      value={seg.conversionFactor}
                      onChange={(e) =>
                        updateSta(
                          i,
                          { conversionFactor: e.target.value },
                          "conversionFactor",
                        )
                      }
                    />
                    <FieldError message={err.conversionFactor} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm" htmlFor={`lf-${i}`}>
                      {seg.useManualLf ? "Manual LF" : "Calculated LF"}
                    </Label>
                    {seg.useManualLf ? (
                      <>
                        <Input
                          id={`lf-${i}`}
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          disabled={!editable || busy}
                          aria-invalid={Boolean(err.manualLf)}
                          className={cn(inputClass, err.manualLf && "border-destructive")}
                          value={seg.manualLf}
                          onChange={(e) =>
                            updateSta(
                              i,
                              { manualLf: e.target.value },
                              "manualLf",
                            )
                          }
                        />
                        <FieldError message={err.manualLf} />
                      </>
                    ) : (
                      <Input
                        id={`lf-${i}`}
                        readOnly
                        className={cn(inputClass, "bg-muted font-semibold")}
                        value={calcPreview(seg)}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {editable && (
            <button
              type="button"
              disabled={busy}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
              onClick={() =>
                setStaSegs((rows) => [
                  ...rows,
                  emptySta(Number(defaultCf) || 1),
                ])
              }
            >
              <Plus className="size-5" /> Add line segment
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {locSegs.map((seg, i) => {
            const err = segErrors[i] ?? {};
            return (
              <div
                key={i}
                className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    Location {i + 1}
                  </p>
                  {locSegs.length > 1 && editable && (
                    <button
                      type="button"
                      className="text-destructive disabled:opacity-50"
                      disabled={busy}
                      aria-label={`Remove location ${i + 1}`}
                      onClick={() => {
                        setLocSegs((rows) =>
                          rows.filter((_, idx) => idx !== i),
                        );
                        setSegErrors({});
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm" htmlFor={`loc-${i}`}>
                    Station / location
                  </Label>
                  <Input
                    id={`loc-${i}`}
                    placeholder="e.g. STA 12+50 NB ramp"
                    disabled={!editable || busy}
                    aria-invalid={Boolean(err.locationDescription)}
                    className={cn(
                      inputClass,
                      err.locationDescription && "border-destructive",
                    )}
                    value={seg.locationDescription}
                    onChange={(e) =>
                      updateLoc(
                        i,
                        { locationDescription: e.target.value },
                        "locationDescription",
                      )
                    }
                  />
                  <FieldError message={err.locationDescription} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm" htmlFor={`sym-${i}`}>
                    Symbol / item type
                  </Label>
                  <Input
                    id={`sym-${i}`}
                    placeholder="e.g. Left turn arrow"
                    disabled={!editable || busy}
                    aria-invalid={Boolean(err.symbolItemType)}
                    className={cn(inputClass, err.symbolItemType && "border-destructive")}
                    value={seg.symbolItemType}
                    onChange={(e) =>
                      updateLoc(
                        i,
                        { symbolItemType: e.target.value },
                        "symbolItemType",
                      )
                    }
                  />
                  <FieldError message={err.symbolItemType} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm" htmlFor={`qty-${i}`}>
                    Quantity ({defaultUnit || task.taskMaster.unit})
                  </Label>
                  <Input
                    id={`qty-${i}`}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    disabled={!editable || busy}
                    aria-invalid={Boolean(err.quantity)}
                    className={cn(inputClass, err.quantity && "border-destructive")}
                    value={seg.quantity}
                    onChange={(e) =>
                      updateLoc(i, { quantity: e.target.value }, "quantity")
                    }
                  />
                  <FieldError message={err.quantity} />
                </div>
              </div>
            );
          })}
          {editable && (
            <button
              type="button"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
              onClick={() =>
                setLocSegs((rows) => [...rows, emptyLoc(defaultSymbol)])
              }
            >
              <Plus className="size-4" /> Add location
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
          <p className="text-sm font-semibold">Report total</p>
          <p className="tabular-nums text-base font-bold">
            {reportTotal > 0
              ? `${reportTotal.toLocaleString()} ${defaultUnit || task.taskMaster.unit}`
              : "—"}
          </p>
        </div>
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-sm" htmlFor="entry-notes">
              Notes
            </Label>
            <textarea
              id="entry-notes"
              disabled={!editable || busy}
              aria-invalid={Boolean(notesError)}
              className={cn(
                "min-h-24 w-full rounded-lg border border-input bg-card px-3 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                notesError && "border-destructive",
              )}
              placeholder="Conditions, partial work, issues…"
              maxLength={2000}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesError(undefined);
              }}
            />
            <FieldError message={notesError} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Attachments</Label>
            {report.attachments.length > 0 && (
              <ul className="space-y-2">
                {report.attachments.map((a) => {
                  const isImage = a.fileType?.startsWith("image/");
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                    >
                      {isImage && a.storageUrl ? (
                        <img
                          src={a.storageUrl}
                          alt={a.fileName}
                          className="size-10 rounded object-cover"
                        />
                      ) : (
                        <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.fileName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {a.category}
                        </p>
                      </div>
                      {a.storageUrl && (
                        <a
                          href={a.storageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-800 underline"
                        >
                          View
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {editable && (
              <div className="space-y-2">
                <select
                  className={selectClass}
                  value={attachCategory}
                  disabled={busy}
                  onChange={(e) => setAttachCategory(e.target.value)}
                >
                  <option value="PHOTO">Photo</option>
                  <option value="TICKET">Ticket</option>
                  <option value="RECEIPT">Receipt</option>
                  <option value="CERTIFICATION">Certification</option>
                  <option value="OTHER">Other</option>
                </select>
                <label
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted-foreground hover:bg-muted/40",
                    busy && "pointer-events-none opacity-50",
                    attachError && "border-destructive",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Paperclip className="size-4" />
                  )}
                  {uploading
                    ? "Uploading…"
                    : `Attach file (max ${attachmentUploadMeta.maxLabel})`}
                  <input
                    type="file"
                    accept={attachmentUploadMeta.accept}
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      void onUploadFile(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <FieldError message={attachError} />
              </div>
            )}
          </div>
        </div>
      </div>

      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-3 py-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="mx-auto flex max-w-lg flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full text-base"
              disabled={busy}
              onClick={() => void saveToReport()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save & go back"
              )}
            </Button>
            <Button
              type="button"
              className="h-12 w-full bg-sky-800 text-base text-white hover:bg-sky-900"
              disabled={busy}
              onClick={() => void saveAndSubmit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Submitting…
                </>
              ) : (
                "Submit for approval"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
