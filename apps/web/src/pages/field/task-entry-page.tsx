import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import {
  attachmentUploadMeta,
  normalizeSta,
  quantityFromStaRange,
  updateDraftReportSchema,
  validateAttachmentFile,
  validateReportTaskSegments,
  type SegmentFieldErrors,
  matchSymbolTypeCode,
  symbolTypeLabelForCode,
  isLocationOnlyFieldEntry,
} from "@frs/shared";
import { apiFetch, apiUpload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { notifyPendingQueueRefresh } from "@/lib/activity-seen";

type LineTypeOption = {
  id: string;
  code: string;
  name: string;
  label: string;
  conversionFactor: number;
  widthInches: number | null;
  color: string | null;
};

type SymbolTypeOption = {
  code: string;
  name: string;
  label: string;
};

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
  projectManagerId: string | null;
  divisionManagers: { id: string; name: string; email: string }[];
  route: {
    beginSta: string | null;
    endSta: string | null;
  } | null;
  tasks: {
    id: string;
    beginSta: string | null;
    endSta: string | null;
    completedStaRanges: { beginSta: string; endSta: string; reportNumber: string }[];
    lineTypes: LineTypeOption[];
    usesLineTypePicker: boolean;
    symbolTypes: SymbolTypeOption[];
    usesSymbolEntry: boolean;
    relatedProjectTaskIds: string[];
    taskMaster: TaskMaster;
  }[];
};

type FieldReport = {
  id: string;
  reportNumber: string;
  notes: string | null;
  status: string;
  divisionManagerId: string | null;
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
    projectTask?: {
      id: string;
      taskMaster: TaskMaster;
    };
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
  lineTypeId: string;
  beginSta: string;
  endSta: string;
  conversionFactor: string;
  useManualLf: boolean;
  manualLf: string;
};

type LocSeg = {
  locationDescription: string;
  symbolTypeCode: string;
  symbolItemType: string;
  quantity: string;
};

const fieldLabelClass = "text-xs font-medium text-muted-foreground";
const fieldHintClass = "text-[11px] leading-snug text-muted-foreground";
const fieldSectionTitleClass = "text-xs font-semibold text-sky-900";
const fieldCardClass =
  "min-w-0 max-w-full space-y-2 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm";
const selectClass =
  "flex h-10 w-full min-w-0 max-w-full truncate rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const inputClass = "h-10 min-w-0 max-w-full text-sm";
const addRowBtnClass =
  "h-10 w-full border-2 border-dashed border-sky-300 bg-sky-50 text-xs font-semibold text-sky-900 hover:bg-sky-100 hover:text-sky-950";

function defaultManagerIdForProject(project: ProjectInfo) {
  return project.projectManagerId ?? project.divisionManagers[0]?.id ?? "";
}

function emptySta(cf: number, lineTypeId = ""): StaSeg {
  return {
    lineTypeId,
    beginSta: "",
    endSta: "",
    conversionFactor: Number.isFinite(cf) ? cf.toFixed(2) : "1.00",
    useManualLf: false,
    manualLf: "",
  };
}

function emptyStaFromLineTypes(lineTypes: LineTypeOption[], fallbackCf = 1): StaSeg {
  const first = lineTypes[0];
  if (first) return emptySta(first.conversionFactor, first.id);
  return emptySta(fallbackCf);
}

function pickLineTypeId(
  lineTypes: LineTypeOption[],
  li: {
    conversionFactor: number | null;
    projectTask?: { taskMaster: { id: string } };
  },
): string {
  const subId = li.projectTask?.taskMaster?.id;
  if (subId && lineTypes.some((lt) => lt.id === subId)) return subId;
  const cf = li.conversionFactor;
  if (cf != null) {
    const matches = lineTypes.filter((lt) => lt.conversionFactor === cf);
    if (matches.length === 1) return matches[0]!.id;
  }
  return lineTypes[0]?.id ?? "";
}

function emptyLoc(defaultSymbol = "", symbolTypes: SymbolTypeOption[] = []): LocSeg {
  const firstCode = symbolTypes[0]?.code ?? "";
  return {
    locationDescription: "",
    symbolTypeCode: firstCode,
    symbolItemType: defaultSymbol,
    quantity: "",
  };
}

function calcPreview(seg: StaSeg, unit: string): string {
  if (seg.useManualLf) {
    const n = Number(seg.manualLf);
    return Number.isFinite(n) && n > 0 ? n.toLocaleString() : "—";
  }
  try {
    const cf = Number(seg.conversionFactor);
    if (!seg.beginSta || !seg.endSta || Number.isNaN(cf)) return "—";
    return quantityFromStaRange(
      unit,
      normalizeSta(seg.beginSta),
      normalizeSta(seg.endSta),
      cf,
    ).toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
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

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [report, setReport] = useState<FieldReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [divisionManagerId, setDivisionManagerId] = useState("");
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
  const [defaultSymbol, setDefaultSymbol] = useState("");
  const [defaultUnit, setDefaultUnit] = useState("LF");

  const task = useMemo(
    () => project?.tasks.find((t) => t.id === taskId) ?? null,
    [project, taskId],
  );

  const isSta = task?.taskMaster.formType === "STA_RANGE";
  const lineTypes = task?.lineTypes ?? [];
  const symbolTypes = task?.symbolTypes ?? [];
  const usesLineTypePicker = Boolean(task?.usesLineTypePicker && lineTypes.length);
  const isSymbolEntry = Boolean(task?.usesSymbolEntry);
  const isLocationOnly =
    !isSta &&
    !isSymbolEntry &&
    isLocationOnlyFieldEntry({
      formType: task?.taskMaster.formType ?? "",
      division: task?.taskMaster.division ?? "",
      masterCode: task?.taskMaster.code ?? "",
      masterName: task?.taskMaster.name ?? "",
    });
  const hasSymbolCatalog = symbolTypes.length > 0;
  const editable =
    report?.status === "DRAFT" || report?.status === "RETURNED";
  const busy = saving || uploading || submitting;

  const managerOptions = useMemo(() => {
    if (!project) return [];
    const primaryId = project.projectManagerId;
    return [...project.divisionManagers].sort((a, b) => {
      if (a.id === primaryId) return -1;
      if (b.id === primaryId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [project]);

  const reportTotal = useMemo(() => {
    if (isSta) {
      return staSegs.reduce((sum, s) => {
        const preview = calcPreview(s, task?.taskMaster.unit ?? "LF");
        const n = Number(String(preview).replace(/,/g, ""));
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
    }
    return locSegs.reduce((sum, s) => {
      const n = Number(s.quantity);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [isSta, staSegs, locSegs]);

  useEffect(() => {
    if (!projectId || !taskId) return;
    void (async () => {
      setLoading(true);
      try {
        const projectsData = await apiFetch<{ projects: ProjectInfo[] }>(
          "/api/v1/field/projects",
        );

        const found =
          projectsData.projects.find((p) => p.id === projectId) ?? null;
        setProject(found);
        const foundTask = found?.tasks.find((t) => t.id === taskId);
        if (!found || !foundTask) {
          toast.error("Task not found");
          return;
        }

        let reportData: FieldReport;
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

        setReport(reportData);
        setNotes(reportData.notes ?? "");
        setDivisionManagerId(
          reportData.divisionManagerId ?? defaultManagerIdForProject(found),
        );

        const relatedIds = new Set(
          foundTask.relatedProjectTaskIds?.length
            ? foundTask.relatedProjectTaskIds
            : [taskId],
        );
        const existing = reportData.lineItems.filter((li) =>
          relatedIds.has(li.projectTaskId),
        );
        const cf = Number(foundTask.taskMaster.conversionFactor ?? 1);
        const taskLineTypes = foundTask.lineTypes ?? [];
        const taskSymbolTypes = foundTask.symbolTypes ?? [];
        const taskUsesPicker =
          foundTask.usesLineTypePicker && taskLineTypes.length > 0;
        const taskUsesSymbolEntry = foundTask.usesSymbolEntry;
        const symbolDefault = foundTask.taskMaster.name;
        setDefaultCf(Number.isFinite(cf) ? cf.toFixed(2) : "1.00");
        setDefaultSymbol(symbolDefault);
        setDefaultUnit(foundTask.taskMaster.unit || "LF");

        const isStaLocal = foundTask.taskMaster.formType === "STA_RANGE";

        if (isStaLocal) {
          if (existing.length) {
            setStaSegs(
              existing.map((li) => ({
                lineTypeId: taskUsesPicker
                  ? pickLineTypeId(taskLineTypes, li)
                  : "",
                beginSta: li.beginSta ?? "",
                endSta: li.endSta ?? "",
                conversionFactor: String(li.conversionFactor ?? cf),
                useManualLf: li.entryType === "MANUAL_FOOTAGE",
                manualLf: li.manualLf != null ? String(li.manualLf) : "",
              })),
            );
          } else if (taskUsesPicker) {
            setStaSegs([emptyStaFromLineTypes(taskLineTypes, cf)]);
          } else {
            setStaSegs([emptySta(cf)]);
          }
        } else if (existing.length) {
          setLocSegs(
            existing.map((li) => {
              const code = taskUsesSymbolEntry
                ? matchSymbolTypeCode(li.symbolItemType, taskSymbolTypes)
                : "";
              return {
                locationDescription: li.locationDescription ?? "",
                symbolTypeCode: code,
                symbolItemType: li.symbolItemType || symbolDefault,
                quantity: String(li.finalQuantity),
              };
            }),
          );
        } else {
          setLocSegs([emptyLoc(symbolDefault, taskSymbolTypes)]);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, taskId, reportIdHint]);

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
          symbolItemType: isSymbolEntry
            ? hasSymbolCatalog
              ? symbolTypeLabelForCode(s.symbolTypeCode, symbolTypes)
              : s.symbolItemType.trim()
            : isLocationOnly
              ? task.taskMaster.name
              : s.symbolItemType.trim() || task.taskMaster.name,
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
      navigate(`/field/projects/${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed", {
        id: "field-entry",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveAndSubmit() {
    if (!report || !task || !editable) return;
    if (!divisionManagerId) {
      toast.error("Select a division manager for this project", {
        id: "field-entry",
      });
      return;
    }
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
        {
          method: "POST",
          body: JSON.stringify({ divisionManagerId }),
        },
      );
      setReport(data.report);
      notifyPendingQueueRefresh();
      toast.success(`Submitted ${data.report.reportNumber}`, {
        id: "field-entry",
      });
      navigate("/field/reports");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed", {
        id: "field-entry",
      });
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
    <div className={cn("min-w-0 overflow-x-hidden space-y-2", editable && "pb-36 lg:pb-8")}>
      <div className="-mx-3 border-b border-sky-100 bg-sky-50 px-3 py-2 lg:mx-0 lg:rounded-xl lg:border">
        <div className="flex items-start gap-2">
          <Link
            to={`/field/projects/${projectId}`}
            className="mt-0.5 inline-flex shrink-0 items-center text-sky-800 hover:text-sky-950"
            aria-label="Back to tasks"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold leading-tight text-sky-950 sm:text-base">
              #{task.taskMaster.code} — {task.taskMaster.name}
            </h1>
            <p className="mt-0.5 text-xs leading-tight text-sky-900/70">
              {project.jobNumber} · {project.name}
              {project.location ? ` · ${project.location}` : ""}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {isSta
          ? "Add a row for each line segment. All rows submit as one entry under this bid item."
          : isSymbolEntry
            ? "Add a row for each symbol. All rows submit as one entry under this bid item."
            : "Add a row for each location. All rows submit as one entry under this bid item."}
      </p>

      {!editable && (
        <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Report is {report.status.replaceAll("_", " ").toLowerCase()} and locked.
        </p>
      )}

      {isSta ? (
        <div className="space-y-2">
          {staSegs.map((seg, i) => {
            const err = segErrors[i] ?? {};
            return (
              <div key={i} className={fieldCardClass}>
                <div className="flex items-center justify-between">
                  <p className={fieldSectionTitleClass}>Segment {i + 1}</p>
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

                {usesLineTypePicker && (
                  <div className="min-w-0 space-y-1">
                    <Label className={fieldLabelClass} htmlFor={`line-type-${i}`}>
                      Line type
                    </Label>
                    <select
                      id={`line-type-${i}`}
                      className={selectClass}
                      disabled={!editable || busy}
                      value={seg.lineTypeId || ""}
                      onChange={(e) => {
                        const lt = lineTypes.find((l) => l.id === e.target.value);
                        updateSta(
                          i,
                          {
                            lineTypeId: e.target.value,
                            conversionFactor: lt
                              ? lt.conversionFactor.toFixed(2)
                              : seg.conversionFactor,
                          },
                          "lineTypeId",
                        );
                      }}
                    >
                      <option value="">Select line type...</option>
                      {lineTypes.map((lt) => (
                        <option key={lt.id} value={lt.id}>
                          {lt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className={fieldLabelClass} htmlFor={`begin-${i}`}>
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
                  <div className="space-y-1">
                    <Label className={fieldLabelClass} htmlFor={`end-${i}`}>
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

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className={fieldLabelClass} htmlFor={`cf-${i}`}>
                      Conv. factor
                    </Label>
                    <Input
                      id={`cf-${i}`}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      disabled={!editable || busy || seg.useManualLf}
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
                    <p className={fieldHintClass}>1.0 = single · 2.0 = double line</p>
                    <FieldError message={err.conversionFactor} />
                  </div>
                  <div className="space-y-1">
                    <Label className={fieldLabelClass} htmlFor={`lf-${i}`}>
                      Calculated{" "}
                      {task.taskMaster.unit.toUpperCase() === "LF"
                        ? "LF"
                        : task.taskMaster.unit}
                    </Label>
                    <Input
                      id={`lf-${i}`}
                      readOnly
                      className={cn(inputClass, "bg-muted/60 font-medium text-muted-foreground")}
                      value={calcPreview(seg, task.taskMaster.unit)}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {editable && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className={addRowBtnClass}
              onClick={() =>
                setStaSegs((rows) => [
                  ...rows,
                  usesLineTypePicker
                    ? emptyStaFromLineTypes(lineTypes, Number(defaultCf) || 1)
                    : emptySta(Number(defaultCf) || 1),
                ])
              }
            >
              <Plus className="size-4" /> Add Line Segment
            </Button>
          )}
        </div>
      ) : isSymbolEntry ? (
        <div className="space-y-2">
          {locSegs.map((seg, i) => {
            const err = segErrors[i] ?? {};
            return (
              <div key={i} className={fieldCardClass}>
                <div className="flex items-center justify-between">
                  <p className={fieldSectionTitleClass}>Symbol {i + 1}</p>
                  {locSegs.length > 1 && editable && (
                    <button
                      type="button"
                      className="text-destructive disabled:opacity-50"
                      disabled={busy}
                      aria-label={`Remove symbol ${i + 1}`}
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

                <div className="space-y-1">
                  <Label className={fieldLabelClass} htmlFor={`station-${i}`}>
                    Station
                  </Label>
                  <Input
                    id={`station-${i}`}
                    placeholder="e.g. 124+50"
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

                <div className="min-w-0 space-y-1">
                  <Label className={fieldLabelClass} htmlFor={`sym-type-${i}`}>
                    Symbol type
                  </Label>
                  {hasSymbolCatalog ? (
                    <select
                      id={`sym-type-${i}`}
                      className={selectClass}
                      disabled={!editable || busy}
                      value={seg.symbolTypeCode || symbolTypes[0]?.code || ""}
                      onChange={(e) =>
                        updateLoc(
                          i,
                          { symbolTypeCode: e.target.value },
                          "symbolItemType",
                        )
                      }
                    >
                      {symbolTypes.map((st) => (
                        <option key={st.code} value={st.code}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`sym-type-${i}`}
                      placeholder="e.g. W12-1 guide sign"
                      disabled={!editable || busy}
                      aria-invalid={Boolean(err.symbolItemType)}
                      className={cn(
                        inputClass,
                        err.symbolItemType && "border-destructive",
                      )}
                      value={seg.symbolItemType}
                      onChange={(e) =>
                        updateLoc(
                          i,
                          { symbolItemType: e.target.value },
                          "symbolItemType",
                        )
                      }
                    />
                  )}
                  <FieldError message={err.symbolItemType} />
                </div>

                <div className="space-y-1">
                  <Label className={fieldLabelClass} htmlFor={`sym-qty-${i}`}>
                    Qty
                  </Label>
                  <Input
                    id={`sym-qty-${i}`}
                    type="number"
                    min={0}
                    step="1"
                    inputMode="numeric"
                    disabled={!editable || busy}
                    aria-invalid={Boolean(err.quantity)}
                    className={cn(
                      inputClass,
                      "max-w-[6rem]",
                      err.quantity && "border-destructive",
                    )}
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
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className={addRowBtnClass}
              onClick={() =>
                setLocSegs((rows) => [
                  ...rows,
                  emptyLoc(defaultSymbol, symbolTypes),
                ])
              }
            >
              <Plus className="size-4" /> Add Symbol
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {locSegs.map((seg, i) => {
            const err = segErrors[i] ?? {};
            return (
              <div key={i} className={fieldCardClass}>
                <div className="flex items-center justify-between">
                  <p className={fieldSectionTitleClass}>Location {i + 1}</p>
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
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <div className="space-y-1">
                    <Label className={fieldLabelClass} htmlFor={`loc-${i}`}>
                      Station / Location
                    </Label>
                    <Input
                      id={`loc-${i}`}
                      placeholder="STA or description"
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
                  <div className="space-y-1 w-[5.5rem]">
                    <Label className={fieldLabelClass} htmlFor={`qty-${i}`}>
                      Qty ({defaultUnit || task.taskMaster.unit})
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
                {!isLocationOnly && (
                  <div className="space-y-1">
                    <Label className={fieldLabelClass} htmlFor={`sym-${i}`}>
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
                )}
              </div>
            );
          })}
          {editable && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className={addRowBtnClass}
              onClick={() =>
                setLocSegs((rows) => [...rows, emptyLoc(defaultSymbol)])
              }
            >
              <Plus className="size-4" /> Add Location
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
        <p className="text-xs font-medium text-sky-900">Report Total</p>
        <p className="tabular-nums text-sm font-bold text-sky-950">
          {reportTotal > 0
            ? `${reportTotal.toLocaleString()} ${defaultUnit || task.taskMaster.unit}`
            : "—"}
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className={fieldLabelClass} htmlFor="entry-notes">
            Notes
          </Label>
          <textarea
            id="entry-notes"
            disabled={!editable || busy}
            aria-invalid={Boolean(notesError)}
            className={cn(
              "min-h-16 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
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
          <Label className={fieldLabelClass}>Attachments</Label>
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
                    "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-xs text-muted-foreground hover:bg-muted/40",
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
                    : "Tap to attach material tickets or photos"}
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

          {editable && (
            <div className="space-y-1 border-t border-border pt-3">
              <Label className={fieldLabelClass} htmlFor="division-manager">
                Division manager
              </Label>
              <p className={fieldHintClass}>
                Project managers only — change if needed before submit
              </p>
              <select
                id="division-manager"
                className={selectClass}
                value={divisionManagerId}
                disabled={busy || managerOptions.length === 0}
                onChange={(e) => setDivisionManagerId(e.target.value)}
              >
                {managerOptions.length === 0 ? (
                  <option value="">No managers on this project</option>
                ) : (
                  managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.id === project?.projectManagerId
                        ? " (project default)"
                        : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
      </div>

      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-3 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
          <div className="mx-auto flex max-w-lg flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full text-sm"
              disabled={busy}
              onClick={() => void saveToReport()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save to Report ✓"
              )}
            </Button>
            <Button
              type="button"
              className="h-10 w-full bg-sky-900 text-sm font-semibold text-white hover:bg-sky-950"
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
