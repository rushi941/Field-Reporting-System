import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  physicalLf,
  reportedLf,
  projectCreateTaskSchema,
  PROJECT_TASK_IMPORT_HEADERS,
} from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { firstZodIssueMessage } from "@/lib/zod-error";
import {
  downloadProjectTaskSampleCsv,
  downloadProjectTaskSampleExcel,
  parseProjectTaskSpreadsheet,
} from "@/lib/project-task-spreadsheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ModalCloseButton,
  UnsavedCloseDialog,
} from "@/components/unsaved-close-dialog";
import type { TaskNode } from "@/types/task-tree";

type FieldLeadOpt = { id: string; name: string; email: string; division: string | null };
type UnitOpt = { id: string; code: string; name: string };

type ProjectTask = {
  id: string;
  taskMasterId: string;
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  division: string;
  sortOrder: number;
  isActive: boolean;
  beginSta: string | null;
  endSta: string | null;
  taskMaster: {
    id: string;
    code: string;
    name: string;
    unit: string;
    formType: string;
    parentId: string | null;
    parent?: { id: string; code: string; name: string } | null;
    division: string | null;
    color: string | null;
    widthInches: number | null;
    conversionFactor: number | null;
  };
};

type ProjectDetail = {
  id: string;
  jobNumber: string;
  name: string;
  division: string;
  divisions: string[];
  location: string | null;
  status: string;
  projectType: { id: string; code: string; name: string } | null;
  taskIds: string[];
  tasks: ProjectTask[];
};

type TableRow = {
  id: string;
  wbs: string;
  taskMasterId: string;
  masterBidCode: string | null;
  masterBidName: string | null;
  subBidCode: string;
  name: string;
  division: string;
  unit: string;
  formType: string;
  color: string | null;
  widthInches: number | null;
  conversionFactor: number | null;
  fieldPerson: string;
  beginSta: string | null;
  endSta: string | null;
};

const divisionLabels: Record<string, string> = {
  PAVEMENT_MARKING: "Pavement Marking",
  TRAFFIC_CONTROL: "Traffic Control",
  PERMANENT_SIGNS: "Permanent Signs",
  MISCELLANEOUS: "Miscellaneous",
};

const formLabels: Record<string, string> = {
  STA_RANGE: "STA Range",
  SINGLE_LOCATION: "Single Location",
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const emptyTaskForm = {
  division: "",
  masterBidId: "",
  subBidId: "",
  name: "",
  unit: "LF",
  formType: "STA_RANGE",
  conversionFactor: "1.00",
  beginSta: "",
  endSta: "",
  description: "",
  assignedToId: "",
};

function workspaceBase(pathname: string) {
  return pathname.startsWith("/office") ? "/office" : "/system";
}

function buildTaskRows(tasks: ProjectTask[]): TableRow[] {
  return tasks.map((t, i) => ({
    id: t.id,
    wbs: String(i + 1),
    taskMasterId: t.taskMasterId,
    masterBidCode: t.taskMaster.parent?.code ?? null,
    masterBidName: t.taskMaster.parent?.name ?? null,
    subBidCode: t.taskMaster.code,
    name: t.taskMaster.name,
    division: t.division,
    unit: t.taskMaster.unit,
    formType: t.taskMaster.formType,
    color: t.taskMaster.color,
    widthInches: t.taskMaster.widthInches,
    conversionFactor: t.taskMaster.conversionFactor,
    fieldPerson: t.assignedTo?.name ?? "—",
    beginSta: t.beginSta,
    endSta: t.endSta,
  }));
}

function parseStaInput(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.includes("+")) {
    const [miles, feet] = raw.split("+");
    const m = Number(miles);
    const f = Number(feet);
    if (Number.isNaN(m) || Number.isNaN(f)) return null;
    return m + f / 100;
  }
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const base = workspaceBase(location.pathname);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [fieldLeads, setFieldLeads] = useState<FieldLeadOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [taskTree, setTaskTree] = useState<TaskNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState(emptyTaskForm);
  const [formBaseline, setFormBaseline] = useState("");
  const [unsavedPrompt, setUnsavedPrompt] = useState(false);

  function snapshotForm(next: typeof emptyTaskForm) {
    return JSON.stringify(next);
  }

  const isDirty =
    addOpen && formBaseline !== "" && snapshotForm(form) !== formBaseline;

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const [p, lookups] = await Promise.all([
        apiFetch<{ project: ProjectDetail }>(`/api/v1/projects/${projectId}`),
        apiFetch<{
          fieldLeads: FieldLeadOpt[];
          taskTree: TaskNode[];
          units: UnitOpt[];
        }>("/api/v1/projects/lookups"),
      ]);
      setProject(p.project);
      setFieldLeads(lookups.fieldLeads);
      setTaskTree(lookups.taskTree);
      setUnits(lookups.units);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load project");
      navigate(`${base}/projects`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  const taskRows = useMemo(
    () => (project ? buildTaskRows(project.tasks) : []),
    [project],
  );

  const showMasterBidColumn = useMemo(
    () => taskRows.some((row) => row.masterBidCode),
    [taskRows],
  );

  const projectDivisions = useMemo(
    () =>
      project && project.divisions.length > 0
        ? project.divisions
        : project
          ? [project.division]
          : [],
    [project],
  );

  const projectFieldLeads = useMemo(() => {
    if (!form.division) return fieldLeads;
    return fieldLeads.filter(
      (u) => !u.division || u.division === form.division,
    );
  }, [fieldLeads, form.division]);

  const divisionMasters = useMemo(() => {
    if (!form.division) return [];
    return taskTree.filter((t) => t.division === form.division);
  }, [taskTree, form.division]);

  const subBidOptions = useMemo(() => {
    if (!form.masterBidId) return [];
    const master = taskTree.find((m) => m.id === form.masterBidId);
    return master?.children ?? [];
  }, [taskTree, form.masterBidId]);

  const selectedSubBid = useMemo(
    () => subBidOptions.find((s) => s.id === form.subBidId) ?? null,
    [subBidOptions, form.subBidId],
  );

  const calc = useMemo(() => {
    const begin = parseStaInput(form.beginSta);
    const end = parseStaInput(form.endSta);
    const cf = Number(form.conversionFactor);
    if (begin == null || end == null || Number.isNaN(cf) || end <= begin) {
      return null;
    }
    const physical = physicalLf(begin, end);
    const reported = reportedLf(begin, end, cf);
    return { physical, reported, cf };
  }, [form.beginSta, form.endSta, form.conversionFactor]);

  function openCreate() {
    const defaultDivision = projectDivisions[0] ?? "PAVEMENT_MARKING";
    const next = { ...emptyTaskForm, division: defaultDivision };
    setForm(next);
    setFormBaseline(snapshotForm(next));
    setUnsavedPrompt(false);
    setAddOpen(true);
  }

  function closeTaskForm() {
    setAddOpen(false);
    setUnsavedPrompt(false);
    setFormBaseline("");
    setForm(emptyTaskForm);
  }

  function requestCloseTaskForm() {
    if (saving) return;
    if (isDirty) {
      setUnsavedPrompt(true);
      return;
    }
    closeTaskForm();
  }

  function onDivisionChange(division: string) {
    setForm((f) => ({
      ...f,
      division,
      masterBidId: "",
      subBidId: "",
      name: "",
      assignedToId: "",
      conversionFactor: "1.00",
    }));
  }

  function onMasterBidChange(id: string) {
    setForm((f) => ({
      ...f,
      masterBidId: id,
      subBidId: "",
      name: "",
      conversionFactor: "1.00",
    }));
  }

  function onSubBidChange(id: string) {
    const sub = subBidOptions.find((s) => s.id === id);
    if (!sub) {
      setForm((f) => ({ ...f, subBidId: id }));
      return;
    }
    setForm((f) => ({
      ...f,
      subBidId: id,
      name: sub.name,
      unit: sub.unit,
      formType: sub.formType,
      conversionFactor:
        sub.conversionFactor != null
          ? Number(sub.conversionFactor).toFixed(2)
          : "1.00",
    }));
  }

  async function saveTaskIds(nextIds: string[]) {
    if (!projectId) return;
    setSaving(true);
    try {
      const data = await apiFetch<{ project: ProjectDetail }>(
        `/api/v1/projects/${projectId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ taskIds: nextIds }),
        },
      );
      setProject(data.project);
      toast.success("Tasks updated", { id: "project-tasks" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed", {
        id: "project-tasks",
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeTask(taskMasterId: string) {
    if (!project) return;
    await saveTaskIds(project.taskIds.filter((id) => id !== taskMasterId));
  }

  async function onCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    if (!form.subBidId) {
      toast.error("Select a master bid and sub-bid", { id: "project-tasks" });
      return;
    }

    setSaving(true);
    try {
      const raw = {
        taskMasterId: form.subBidId,
        assignedToId: form.assignedToId,
        division: form.division,
        formType: form.formType,
        beginSta: form.beginSta.trim() || null,
        endSta: form.endSta.trim() || null,
        description: form.description.trim() || null,
      };
      const parsed = projectCreateTaskSchema.safeParse(raw);
      if (!parsed.success) {
        toast.error(firstZodIssueMessage(parsed.error), { id: "project-tasks" });
        return;
      }
      const data = await apiFetch<{ project: ProjectDetail }>(
        `/api/v1/projects/${projectId}/tasks`,
        {
          method: "POST",
          body: JSON.stringify(parsed.data),
        },
      );
      setProject(data.project);
      closeTaskForm();
      toast.success("Task created", { id: "project-tasks" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed", {
        id: "project-tasks",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onImportTasks() {
    if (!projectId || !importFile) {
      toast.error("Choose a CSV or Excel file", { id: "project-import" });
      return;
    }
    setImporting(true);
    try {
      const rows = await parseProjectTaskSpreadsheet(importFile);
      if (!rows.length) {
        toast.error(
          "No valid task rows found. Download the sample file and match the column headers exactly.",
          { id: "project-import" },
        );
        return;
      }
      const result = await apiFetch<{
        created: number;
        errorCount: number;
        errors: { row: number; message: string }[];
        project: ProjectDetail;
      }>(`/api/v1/projects/${projectId}/tasks/import`, {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      setProject(result.project);
      setImportOpen(false);
      setImportFile(null);
      if (result.errorCount > 0) {
        const detail = result.errors
          .slice(0, 3)
          .map((e) => `Row ${e.row}: ${e.message}`)
          .join(" · ");
        toast.warning(
          `Imported ${result.created} task(s), ${result.errorCount} error(s). ${detail}`,
          { id: "project-import", duration: 8000 },
        );
      } else {
        toast.success(`Imported ${result.created} task(s)`, {
          id: "project-import",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed", {
        id: "project-import",
      });
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading project…
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={`${base}/projects`}
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Projects
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {project.jobNumber}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              project.projectType?.name,
              projectDivisions
                .map((d) => divisionLabels[d] ?? d)
                .join(", "),
              project.location,
              project.status,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import tasks
          </Button>
          <Button
            className="bg-asphalt-mid text-white hover:bg-asphalt"
            onClick={openCreate}
          >
            <Plus className="size-4" /> Add task
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b bg-muted/40 px-2 py-1">
          <div>
            <h2 className="text-sm font-semibold">Project tasks</h2>
            <p className="text-xs text-muted-foreground">
              Work scope with line code, width, and conversion factor
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {project.taskIds.length} items
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="w-20 px-2 py-1">WBS</th>
                {showMasterBidColumn && (
                  <th className="px-2 py-1">Master bid</th>
                )}
                <th className="w-28 px-2 py-1">Sub-bid code</th>
                <th className="px-2 py-1">Sub-bid name</th>
                <th className="w-36 px-2 py-1">Division</th>
                <th className="w-20 px-2 py-1">Unit</th>
                <th className="w-28 px-2 py-1">Form</th>
                <th className="w-20 px-2 py-1">Color</th>
                <th className="w-20 px-2 py-1">Width</th>
                <th className="w-16 px-2 py-1">CF</th>
                <th className="w-36 px-2 py-1">Work STA</th>
                <th className="w-36 px-2 py-1">Field person</th>
                <th className="w-16 px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {taskRows.length === 0 && (
                <tr>
                  <td
                    colSpan={showMasterBidColumn ? 13 : 12}
                    className="px-2 py-4 text-center text-sm text-muted-foreground"
                  >
                    No tasks yet. Click <strong>Add task</strong> or{" "}
                    <strong>Import tasks</strong> to add work scope.
                  </td>
                </tr>
              )}
              {taskRows.map((row) => (
                <tr
                  key={row.taskMasterId}
                  className="border-b last:border-0 hover:bg-muted/10"
                >
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">
                    {row.wbs}
                  </td>
                  {showMasterBidColumn && (
                    <td className="px-2 py-1 text-xs">
                      <span className="font-mono">{row.masterBidCode ?? "—"}</span>
                      {row.masterBidName && (
                        <p className="mt-0.5 text-muted-foreground">
                          {row.masterBidName}
                        </p>
                      )}
                    </td>
                  )}
                  <td className="px-2 py-1 font-mono text-xs">{row.subBidCode}</td>
                  <td className="px-2 py-1">{row.name}</td>
                  <td className="px-2 py-1 text-xs">
                    {divisionLabels[row.division] ?? row.division}
                  </td>
                  <td className="px-2 py-1 text-xs">{row.unit}</td>
                  <td className="px-2 py-1 text-xs">
                    {formLabels[row.formType] ?? row.formType}
                  </td>
                  <td className="px-2 py-1 text-xs">{row.color ?? "—"}</td>
                  <td className="px-2 py-1 text-xs">
                    {row.widthInches != null ? `${row.widthInches}"` : "—"}
                  </td>
                  <td className="px-2 py-1 text-xs tabular-nums">
                    {row.conversionFactor != null
                      ? Number(row.conversionFactor).toFixed(2)
                      : "—"}
                  </td>
                  <td className="px-2 py-1 font-mono text-[11px]">
                    {row.formType === "STA_RANGE" && row.beginSta && row.endSta
                      ? `${row.beginSta} → ${row.endSta}`
                      : row.formType === "STA_RANGE"
                        ? "— set limits"
                        : "—"}
                  </td>
                  <td className="px-2 py-1 text-xs">{row.fieldPerson}</td>
                  <td className="px-2 py-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconSm"
                      disabled={saving}
                      title="Remove task"
                      onClick={() => void removeTask(row.taskMasterId)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UnsavedCloseDialog
        open={unsavedPrompt}
        saving={saving}
        onStay={() => setUnsavedPrompt(false)}
        onDiscard={closeTaskForm}
        onSave={() => {
          setUnsavedPrompt(false);
          const formEl = document.getElementById(
            "project-task-form-modal",
          ) as HTMLFormElement | null;
          formEl?.requestSubmit();
        }}
      />

      {addOpen && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <form
            id="project-task-form-modal"
            onSubmit={onCreateTask}
            className="relative z-[2001] max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Create task</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select master bid and sub-bid from Bid Master, then assign field
                  person and STA limits.
                </p>
              </div>
              <ModalCloseButton
                onClick={requestCloseTaskForm}
                disabled={saving}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {projectDivisions.length > 1 && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Division *</Label>
                  <select
                    className={selectClass}
                    value={form.division}
                    onChange={(e) => onDivisionChange(e.target.value)}
                    required
                  >
                    {projectDivisions.map((d) => (
                      <option key={d} value={d}>
                        {divisionLabels[d] ?? d}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Master bid *</Label>
                <select
                  className={selectClass}
                  value={form.masterBidId}
                  onChange={(e) => onMasterBidChange(e.target.value)}
                  required
                >
                  <option value="">— Select master bid —</option>
                  {divisionMasters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {m.name}
                      {m.children.length
                        ? ` (${m.children.length} sub-bids)`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Sub-bid *</Label>
                <select
                  className={selectClass}
                  value={form.subBidId}
                  onChange={(e) => onSubBidChange(e.target.value)}
                  required
                  disabled={!form.masterBidId}
                >
                  <option value="">— Select sub-bid —</option>
                  {subBidOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                      {s.widthInches != null ? ` · ${s.widthInches}"` : ""}
                      {s.conversionFactor != null
                        ? ` · CF ${Number(s.conversionFactor).toFixed(2)}`
                        : ""}
                    </option>
                  ))}
                </select>
                {form.masterBidId && subBidOptions.length === 0 && (
                  <p className="text-xs text-amber-700">
                    No sub-bids under this master — add them in Bid Master first.
                  </p>
                )}
              </div>

              {selectedSubBid && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Sub-bid details</Label>
                  <Input
                    readOnly
                    className="bg-muted text-muted-foreground"
                    value={`${selectedSubBid.code} · ${selectedSubBid.name} · ${selectedSubBid.unit}${selectedSubBid.color ? ` · ${selectedSubBid.color}` : ""}`}
                  />
                </div>
              )}

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Field person *</Label>
                <select
                  className={selectClass}
                  value={form.assignedToId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assignedToId: e.target.value }))
                  }
                  required
                >
                  <option value="">— Select field person —</option>
                  {projectFieldLeads.length === 0 ? (
                    <option value="" disabled>
                      No field leads for this division — add users with Field Lead role
                    </option>
                  ) : (
                    projectFieldLeads.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                        {u.division
                          ? ` · ${divisionLabels[u.division] ?? u.division}`
                          : ""}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  Task appears on that field lead&apos;s My jobs screen.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Conversion factor (CF)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.conversionFactor}
                  readOnly
                  className="bg-muted"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input readOnly className="bg-muted" value={form.unit} />
              </div>

              <div className="space-y-1.5">
                <Label>Form type</Label>
                <Input readOnly className="bg-muted" value={formLabels[form.formType] ?? form.formType} />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Begin STA {form.formType === "STA_RANGE" ? "*" : "(calc)"}
                </Label>
                <Input
                  value={form.beginSta}
                  required={form.formType === "STA_RANGE"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, beginSta: e.target.value }))
                  }
                  placeholder="11+00"
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  End STA {form.formType === "STA_RANGE" ? "*" : "(calc)"}
                </Label>
                <Input
                  value={form.endSta}
                  required={form.formType === "STA_RANGE"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endSta: e.target.value }))
                  }
                  placeholder="23+00"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Notes</Label>
                <textarea
                  className="min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 rounded-md border border-border bg-card px-2 py-1 text-sm">
              <p className="font-medium">Calculation</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Physical LF = (End STA − Begin STA) × 100 · Reported LF =
                Physical LF × CF
              </p>
              {calc ? (
                <div className="mt-2 grid gap-1 sm:grid-cols-3">
                  <p>
                    Physical LF:{" "}
                    <strong className="tabular-nums">
                      {calc.physical.toLocaleString()}
                    </strong>
                  </p>
                  <p>
                    CF:{" "}
                    <strong className="tabular-nums">
                      {calc.cf.toFixed(2)}
                    </strong>
                  </p>
                  <p>
                    Reported LF:{" "}
                    <strong className="tabular-nums">
                      {calc.reported.toLocaleString()}
                    </strong>
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Enter Begin STA and End STA to preview Reported LF.
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={requestCloseTaskForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-asphalt-mid text-white hover:bg-asphalt"
                disabled={saving}
              >
                {saving ? "Saving…" : "Create task"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {importOpen && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black/45 p-4">
          <div className="relative z-[2001] w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Import project tasks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a CSV or Excel file with task rows for this project.
            </p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {PROJECT_TASK_IMPORT_HEADERS.join(", ")}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadProjectTaskSampleCsv()}
              >
                <Download className="size-4" /> Sample CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadProjectTaskSampleExcel()}
              >
                <Download className="size-4" /> Sample Excel
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="project-task-import-file">File</Label>
              <Input
                id="project-task-import-file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) =>
                  setImportFile(e.target.files?.[0] ?? null)
                }
              />
              {importFile ? (
                <p className="text-xs text-muted-foreground">
                  Selected: {importFile.name}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={importing}
                onClick={() => {
                  setImportOpen(false);
                  setImportFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-asphalt-mid text-white hover:bg-asphalt"
                disabled={importing || !importFile}
                onClick={() => void onImportTasks()}
              >
                {importing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Importing…
                  </>
                ) : (
                  <>
                    <Upload className="size-4" /> Import
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
