import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  LINE_COLORS,
  LINE_WIDTHS,
  buildLineCode,
  conversionFactorFor,
  pavementLineTypes,
  physicalLf,
  reportedLf,
  type LineColorCode,
  type LineTypeDef,
  type LineWidth,
} from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldLeadOpt = { id: string; name: string; email: string; division: string | null };

type ProjectTask = {
  id: string;
  taskMasterId: string;
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  division: string;
  sortOrder: number;
  isActive: boolean;
  taskMaster: {
    id: string;
    code: string;
    name: string;
    unit: string;
    formType: string;
    parentId: string | null;
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
  location: string | null;
  status: string;
  projectType: { id: string; code: string; name: string } | null;
  taskIds: string[];
  tasks: ProjectTask[];
};

type TableRow = {
  wbs: string;
  taskMasterId: string;
  code: string;
  name: string;
  unit: string;
  formType: string;
  color: string | null;
  widthInches: number | null;
  conversionFactor: number | null;
  fieldPerson: string;
};

const divisionLabels: Record<string, string> = {
  PAVEMENT_MARKING: "Pavement Marking",
  TRAFFIC_CONTROL: "Traffic Control",
  PERMANENT_SIGNS: "Permanent Signs",
};

const formLabels: Record<string, string> = {
  STA_RANGE: "STA Range",
  SINGLE_LOCATION: "Single Location",
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const emptyTaskForm = {
  lineTypeKey: "",
  name: "",
  color: "W" as LineColorCode,
  widthInches: 4 as LineWidth,
  conversionFactor: "1.00",
  unit: "LF",
  formType: "STA_RANGE",
  beginSta: "",
  endSta: "",
  description: "",
  assignedToId: "",
};

function lineTypeKey(def: LineTypeDef) {
  return `${def.prefix}|${def.color}|${def.name}`;
}

function workspaceBase(pathname: string) {
  return pathname.startsWith("/office") ? "/office" : "/system";
}

function buildTaskRows(tasks: ProjectTask[]): TableRow[] {
  return tasks.map((t, i) => ({
    wbs: String(i + 1),
    taskMasterId: t.taskMasterId,
    code: t.taskMaster.code,
    name: t.taskMaster.name,
    unit: t.taskMaster.unit,
    formType: t.taskMaster.formType,
    color: t.taskMaster.color,
    widthInches: t.taskMaster.widthInches,
    conversionFactor: t.taskMaster.conversionFactor,
    fieldPerson: t.assignedTo?.name ?? "—",
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyTaskForm);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const [p, lookups] = await Promise.all([
        apiFetch<{ project: ProjectDetail }>(`/api/v1/projects/${projectId}`),
        apiFetch<{ fieldLeads: FieldLeadOpt[] }>("/api/v1/projects/lookups"),
      ]);
      setProject(p.project);
      setFieldLeads(lookups.fieldLeads);
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

  const projectFieldLeads = useMemo(() => fieldLeads, [fieldLeads]);

  const selectedLineType = useMemo(
    () =>
      pavementLineTypes.find((d) => lineTypeKey(d) === form.lineTypeKey) ?? null,
    [form.lineTypeKey],
  );

  const lineCode = useMemo(() => {
    if (!selectedLineType) return "";
    return buildLineCode(
      selectedLineType.prefix,
      form.color,
      form.widthInches,
    );
  }, [selectedLineType, form.color, form.widthInches]);

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
    setForm(emptyTaskForm);
    setAddOpen(true);
  }

  function onLineTypeChange(key: string) {
    const def = pavementLineTypes.find((d) => lineTypeKey(d) === key);
    if (!def) {
      setForm((f) => ({ ...f, lineTypeKey: key }));
      return;
    }
    const width = (def.widths[0] ?? 4) as LineWidth;
    const cf = conversionFactorFor(def, width);
    setForm((f) => ({
      ...f,
      lineTypeKey: key,
      name: `${def.name} ${LINE_COLORS[def.color]}`,
      color: def.color,
      widthInches: width,
      conversionFactor: cf.toFixed(2),
      formType: def.formType ?? "STA_RANGE",
    }));
  }

  function onWidthChange(width: LineWidth) {
    const cf = selectedLineType
      ? conversionFactorFor(selectedLineType, width)
      : Number(form.conversionFactor);
    setForm((f) => ({
      ...f,
      widthInches: width,
      conversionFactor: Number.isFinite(cf) ? cf.toFixed(2) : f.conversionFactor,
      name: selectedLineType
        ? `${selectedLineType.name} ${LINE_COLORS[f.color]} ${width}"`
        : f.name,
    }));
  }

  function onColorChange(color: LineColorCode) {
    setForm((f) => ({
      ...f,
      color,
      name: selectedLineType
        ? `${selectedLineType.name} ${LINE_COLORS[color]} ${f.widthInches}"`
        : f.name,
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
    if (!form.name.trim()) {
      toast.error("Enter a task name", { id: "project-tasks" });
      return;
    }
    if (!form.assignedToId) {
      toast.error("Select a field person", { id: "project-tasks" });
      return;
    }
    const cf = Number(form.conversionFactor);
    if (Number.isNaN(cf) || cf < 0) {
      toast.error("Enter a valid conversion factor", { id: "project-tasks" });
      return;
    }
    const code =
      lineCode ||
      form.name.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 40);
    if (!code) {
      toast.error("Select a line type or enter a name", { id: "project-tasks" });
      return;
    }

    setSaving(true);
    try {
      const data = await apiFetch<{ project: ProjectDetail }>(
        `/api/v1/projects/${projectId}/tasks`,
        {
          method: "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            code,
            unit: form.unit,
            formType: form.formType,
            color: LINE_COLORS[form.color],
            widthInches: form.widthInches,
            conversionFactor: cf,
            description: form.description.trim() || null,
            assignedToId: form.assignedToId,
            beginSta: parseStaInput(form.beginSta),
            endSta: parseStaInput(form.endSta),
          }),
        },
      );
      setProject(data.project);
      setAddOpen(false);
      setForm(emptyTaskForm);
      toast.success("Task created", { id: "project-tasks" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed", {
        id: "project-tasks",
      });
    } finally {
      setSaving(false);
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
              divisionLabels[project.division] ?? project.division,
              project.location,
              project.status,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button
          className="bg-asphalt-mid text-white hover:bg-asphalt"
          onClick={openCreate}
        >
          <Plus className="size-4" /> Add task
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
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
                <th className="w-20 px-4 py-3">WBS</th>
                <th className="w-28 px-4 py-3">Code</th>
                <th className="px-4 py-3">Task name</th>
                <th className="w-20 px-4 py-3">Unit</th>
                <th className="w-28 px-4 py-3">Form</th>
                <th className="w-20 px-4 py-3">Color</th>
                <th className="w-20 px-4 py-3">Width</th>
                <th className="w-16 px-4 py-3">CF</th>
                <th className="w-36 px-4 py-3">Field person</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {taskRows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No tasks yet. Click <strong>Add task</strong> to create work
                    with line code and conversion factor.
                  </td>
                </tr>
              )}
              {taskRows.map((row) => (
                <tr
                  key={row.taskMasterId}
                  className="border-b last:border-0 hover:bg-muted/10"
                >
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {row.wbs}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-2.5">{row.name}</td>
                  <td className="px-4 py-2.5 text-xs">{row.unit}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {formLabels[row.formType] ?? row.formType}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{row.color ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {row.widthInches != null ? `${row.widthInches}"` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums">
                    {row.conversionFactor != null
                      ? Number(row.conversionFactor).toFixed(2)
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{row.fieldPerson}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
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

      {addOpen && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={onCreateTask}
            className="relative z-[2001] max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-6 shadow-2xl"
          >
            <h2 className="text-lg font-semibold">Create task</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Line code is built as type + color + width. Reported LF = (End STA
              − Begin STA) × 100 × CF.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Line type</Label>
                <select
                  className={selectClass}
                  value={form.lineTypeKey}
                  onChange={(e) => onLineTypeChange(e.target.value)}
                >
                  <option value="">— Select line type —</option>
                  {pavementLineTypes.map((d) => (
                    <option key={lineTypeKey(d)} value={lineTypeKey(d)}>
                      {d.prefix}
                      {d.color} — {d.name} ({LINE_COLORS[d.color]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Task name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Edge Line Right White 4&quot;"
                  required
                />
              </div>

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
                      No field leads found — add users with Field Lead role
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
                <Label>Color</Label>
                <select
                  className={selectClass}
                  value={form.color}
                  onChange={(e) =>
                    onColorChange(e.target.value as LineColorCode)
                  }
                >
                  {(Object.keys(LINE_COLORS) as LineColorCode[]).map((c) => (
                    <option key={c} value={c}>
                      {c} — {LINE_COLORS[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Width (in)</Label>
                <select
                  className={selectClass}
                  value={form.widthInches}
                  onChange={(e) =>
                    onWidthChange(Number(e.target.value) as LineWidth)
                  }
                >
                  {LINE_WIDTHS.map((w) => (
                    <option key={w} value={w}>
                      {w}&quot;
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Line code</Label>
                <Input
                  value={lineCode || "—"}
                  readOnly
                  className="bg-muted font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Conversion factor (CF) *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.conversionFactor}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      conversionFactor: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input
                  value={form.unit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unit: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Form type</Label>
                <select
                  className={selectClass}
                  value={form.formType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, formType: e.target.value }))
                  }
                >
                  <option value="STA_RANGE">STA Range</option>
                  <option value="SINGLE_LOCATION">Single Location</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Begin STA (calc)</Label>
                <Input
                  value={form.beginSta}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, beginSta: e.target.value }))
                  }
                  placeholder="142+00 or 142.00"
                />
              </div>

              <div className="space-y-1.5">
                <Label>End STA (calc)</Label>
                <Input
                  value={form.endSta}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endSta: e.target.value }))
                  }
                  placeholder="147+00 or 147.00"
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

            <div className="mt-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
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
                onClick={() => setAddOpen(false)}
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
    </div>
  );
}
