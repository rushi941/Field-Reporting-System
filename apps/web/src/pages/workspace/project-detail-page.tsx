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
  projectCreateTaskSchema,
  PROJECT_TASK_IMPORT_HEADERS,
  physicalLfFromSta,
  stationSpanDecimal,
} from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { firstZodIssueMessage } from "@/lib/zod-error";
import { useAuth } from "@/auth/auth-context";
import {
  ReportHistoryCard,
  type ReportHistoryCardData,
} from "@/components/report-history-card";
import {
  downloadProjectTaskSampleCsv,
  downloadProjectTaskSampleExcel,
  parseProjectTaskSpreadsheet,
} from "@/lib/project-task-spreadsheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ModalCloseButton,
  UnsavedCloseDialog,
} from "@/components/unsaved-close-dialog";
import { ModalOverlay } from "@/components/modal-overlay";
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
  fieldLeadIds: string[];
  fieldLeads: { id: string; name: string; email: string }[];
  projectType: { id: string; code: string; name: string } | null;
  taskIds: string[];
  tasks: ProjectTask[];
};

type TableRow = {
  id: string;
  wbs: string;
  taskMasterId: string;
  code: string;
  name: string;
  division: string;
  unit: string;
  formType: string;
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
  assignedToId: "",
  formType: "STA_RANGE",
  beginSta: "",
  endSta: "",
  description: "",
};

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-muted/15 p-5">
      <div className="mb-4 border-b border-border pb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function FormField({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("space-y-1.5", className)}>{children}</div>;
}

function workspaceBase(pathname: string) {
  return pathname.startsWith("/office") ? "/office" : "/system";
}

function buildTaskRows(tasks: ProjectTask[]): TableRow[] {
  const seen = new Set<string>();
  const rows: TableRow[] = [];

  for (const t of tasks) {
    const master = t.taskMaster.parent ?? t.taskMaster;
    if (seen.has(master.id)) continue;
    seen.add(master.id);

    rows.push({
      id: t.id,
      wbs: String(rows.length + 1),
      taskMasterId: master.id,
      code: master.code,
      name: master.name,
      division: t.division,
      unit: master.unit,
      formType: master.formType,
      fieldPerson: t.assignedTo?.name ?? "—",
      beginSta: t.beginSta,
      endSta: t.endSta,
    });
  }

  return rows;
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const base = workspaceBase(location.pathname);
  const isProjectAdminWorkspace = base === "/office";
  const { can } = useAuth();
  const canViewReports = can("reports.view_project_history");

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [fieldReports, setFieldReports] = useState<ReportHistoryCardData[]>([]);
  const [reportCounts, setReportCounts] = useState({
    approved: 0,
    pending: 0,
    returned: 0,
    total: 0,
  });
  const [reportsLoading, setReportsLoading] = useState(false);
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

  useEffect(() => {
    if (!projectId || !canViewReports) {
      setFieldReports([]);
      return;
    }
    void (async () => {
      setReportsLoading(true);
      try {
        const data = await apiFetch<{
          reports: ReportHistoryCardData[];
          statusCounts: {
            approved: number;
            pending: number;
            returned: number;
            total: number;
          };
        }>(`/api/v1/workspace-reports/projects/${projectId}`);
        setFieldReports(
          data.reports
            .filter((r) => r.status !== "DRAFT")
            .slice(0, 5) as ReportHistoryCardData[],
        );
        setReportCounts(data.statusCounts);
      } catch {
        setFieldReports([]);
      } finally {
        setReportsLoading(false);
      }
    })();
  }, [projectId, canViewReports]);

  const taskRows = useMemo(
    () => (project ? buildTaskRows(project.tasks) : []),
    [project],
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
    const projectLeadIds = new Set(
      project?.fieldLeadIds ?? project?.fieldLeads.map((fl) => fl.id) ?? [],
    );
    if (projectLeadIds.size === 0) return [];

    let pool = fieldLeads.filter((u) => projectLeadIds.has(u.id));
    if (form.division) {
      pool = pool.filter(
        (u) => !u.division || u.division === form.division,
      );
    }
    return pool;
  }, [fieldLeads, project, form.division]);

  const divisionMasters = useMemo(() => {
    if (!form.division) return [];
    return taskTree.filter((t) => t.division === form.division);
  }, [taskTree, form.division]);

  const selectedMaster = useMemo(
    () => taskTree.find((m) => m.id === form.masterBidId) ?? null,
    [taskTree, form.masterBidId],
  );

  const lineTypesAtFieldEntry = Boolean(
    selectedMaster?.children.length &&
      form.division === "PAVEMENT_MARKING" &&
      form.formType === "STA_RANGE",
  );

  const staPreview = useMemo(() => {
    if (!form.beginSta.trim() || !form.endSta.trim()) return null;
    try {
      const span = stationSpanDecimal(form.beginSta, form.endSta);
      if (span <= 0) return null;
      const physical = physicalLfFromSta(form.beginSta, form.endSta);
      return { span, physical };
    } catch {
      return null;
    }
  }, [form.beginSta, form.endSta]);

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
      assignedToId: "",
      formType: "STA_RANGE",
      beginSta: "",
      endSta: "",
    }));
  }

  function onMasterBidChange(id: string) {
    const master = taskTree.find((m) => m.id === id);
    setForm((f) => ({
      ...f,
      masterBidId: id,
      formType: master?.formType ?? "STA_RANGE",
      beginSta: "",
      endSta: "",
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

  async function removeTask(masterTaskMasterId: string) {
    if (!project) return;
    const drop = new Set<string>([masterTaskMasterId]);
    for (const t of project.tasks) {
      const mid = t.taskMaster.parent?.id ?? t.taskMaster.id;
      if (mid === masterTaskMasterId) drop.add(t.taskMasterId);
    }
    await saveTaskIds(project.taskIds.filter((id) => !drop.has(id)));
  }

  async function onCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    if (!form.masterBidId) {
      toast.error("Select a master bid", { id: "project-tasks" });
      return;
    }

    setSaving(true);
    try {
      const master = taskTree.find((m) => m.id === form.masterBidId);
      const raw = {
        taskMasterId: form.masterBidId,
        assignedToId: form.assignedToId,
        division: form.division,
        formType: master?.formType ?? form.formType,
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
          {canViewReports && isProjectAdminWorkspace && (
            <Button asChild variant="outline">
              <Link to={`${base}/reports/history?projectId=${project.id}`}>
                Approval history
              </Link>
            </Button>
          )}
          {canViewReports && (
            <Button asChild variant="outline">
              <Link to={`${base}/reports/${project.id}`}>Field reports</Link>
            </Button>
          )}
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

      {canViewReports && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Field report status</h2>
              <p className="text-xs text-muted-foreground">
                View-only — approved and returned reports from division managers
              </p>
            </div>
            <Link
              to={`${base}/reports/${project.id}`}
              className="text-xs font-medium text-sky-800 hover:underline"
            >
              View all
            </Link>
            {isProjectAdminWorkspace ? (
              <Link
                to={`${base}/reports/history?projectId=${project.id}`}
                className="text-xs font-medium text-sky-800 hover:underline"
              >
                Approval history
              </Link>
            ) : null}
          </div>
          <div className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <StatPill label="Approved" value={reportCounts.approved} tone="ok" />
              <StatPill label="Under review" value={reportCounts.pending} />
              <StatPill label="Returned" value={reportCounts.returned} tone="warn" />
            </div>
            {reportsLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading reports…
              </p>
            ) : fieldReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No submitted field reports yet.
              </p>
            ) : (
              <ul className="min-w-0 space-y-2">
                {fieldReports.map((r) => (
                  <li key={r.id}>
                    <ReportHistoryCard
                      report={r}
                      linkTo={`${base}/reports/${project.id}/${r.id}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b bg-muted/40 px-2 py-1">
          <div>
            <h2 className="text-sm font-semibold">Project tasks</h2>
            <p className="text-xs text-muted-foreground">
              Master tasks assigned to field persons — quantities and STA are
              entered in the field app.
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
                <th className="w-28 px-2 py-1">Master code</th>
                <th className="px-2 py-1">Master name</th>
                <th className="w-36 px-2 py-1">Division</th>
                <th className="w-20 px-2 py-1">Unit</th>
                <th className="w-28 px-2 py-1">Form</th>
                <th className="w-36 px-2 py-1">Work STA</th>
                <th className="w-36 px-2 py-1">Field person</th>
                <th className="w-16 px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {taskRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
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
                  <td className="px-2 py-1 font-mono text-xs">{row.code}</td>
                  <td className="px-2 py-1">{row.name}</td>
                  <td className="px-2 py-1 text-xs">
                    {divisionLabels[row.division] ?? row.division}
                  </td>
                  <td className="px-2 py-1 text-xs">{row.unit}</td>
                  <td className="px-2 py-1 text-xs">
                    {formLabels[row.formType] ?? row.formType}
                  </td>
                  <td className="px-2 py-1 font-mono text-[11px]">
                    {row.formType === "STA_RANGE" && row.beginSta && row.endSta
                      ? `${row.beginSta} → ${row.endSta}`
                      : row.formType === "STA_RANGE"
                        ? "—"
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

      <ModalOverlay open={addOpen} onBackdropClick={requestCloseTaskForm}>
        <form
          id="project-task-form-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-task-form-title"
          onSubmit={onCreateTask}
          onClick={(e) => e.stopPropagation()}
          className="relative z-[2001] flex max-h-[min(94dvh,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl sm:max-h-[90vh]"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id="project-task-form-title" className="text-xl font-semibold">
                Add task
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a master bid, assign a field person, and set work limits.
                {lineTypesAtFieldEntry
                  ? " Line types are chosen by the field lead when entering quantities."
                  : null}
              </p>
            </div>
            <ModalCloseButton
              onClick={requestCloseTaskForm}
              disabled={saving}
            />
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <FormSection
              title="Assignment"
              description="Master bid and field person for this work"
            >
              {projectDivisions.length > 1 && (
                <FormField className="sm:col-span-2">
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
                </FormField>
              )}

              <FormField className="sm:col-span-2">
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
                    </option>
                  ))}
                </select>
                {selectedMaster ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedMaster.unit} ·{" "}
                    {formLabels[selectedMaster.formType] ?? selectedMaster.formType}
                  </p>
                ) : null}
              </FormField>

              <FormField className="sm:col-span-2">
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
                      Add field persons on the project first
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
                  Only field persons assigned to this project are listed.
                </p>
              </FormField>
            </FormSection>

            {form.formType === "STA_RANGE" && (
              <FormSection
                title="Work limits"
                description="Station range for this task on the project"
              >
                <FormField>
                  <Label>Begin STA *</Label>
                  <Input
                    value={form.beginSta}
                    required
                    onChange={(e) =>
                      setForm((f) => ({ ...f, beginSta: e.target.value }))
                    }
                    placeholder="11+00"
                  />
                </FormField>
                <FormField>
                  <Label>End STA *</Label>
                  <Input
                    value={form.endSta}
                    required
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endSta: e.target.value }))
                    }
                    placeholder="23+00"
                  />
                </FormField>
                {lineTypesAtFieldEntry ? (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Work limits only — line type and conversion factor are
                    selected in the field app.
                  </p>
                ) : null}
                {staPreview ? (
                  <div className="sm:col-span-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <p className="font-medium">Calculation</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      STA span = End − Begin · Physical LF = span × 100
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <p>
                        STA span:{" "}
                        <strong className="tabular-nums">
                          {staPreview.span.toFixed(2)}
                        </strong>
                      </p>
                      <p>
                        Physical LF:{" "}
                        <strong className="tabular-nums">
                          {staPreview.physical.toLocaleString()} LF
                        </strong>
                      </p>
                    </div>
                  </div>
                ) : null}
              </FormSection>
            )}

            <FormSection title="Notes" description="Optional instructions">
              <FormField className="sm:col-span-2">
                <Label>Notes</Label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Optional instructions for the field lead"
                />
              </FormField>
            </FormSection>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
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
              {saving ? "Saving…" : "Add task"}
            </Button>
          </div>
        </form>
      </ModalOverlay>

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

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  return (
    <span
      className={
        tone === "ok" && value > 0
          ? "rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-900"
          : tone === "warn" && value > 0
            ? "rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900"
            : "rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground"
      }
    >
      {label}: {value}
    </span>
  );
}
