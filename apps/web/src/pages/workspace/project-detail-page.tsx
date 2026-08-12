import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Upload,
} from "lucide-react";
import {
  adminFieldEntryPreview,
  adminNeedsStaWorkLimits,
  FORM_TYPE_LABELS,
  formTypeLabel,
  isStaFormType,
  projectCreateTaskSchema,
  PROJECT_TASK_IMPORT_HEADERS,
  physicalLfFromSta,
  stationSpanDecimal,
  sanitizeStaInput,
} from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { firstZodIssueMessage } from "@/lib/zod-error";
import { useAuth } from "@/auth/auth-context";
import {
  downloadProjectTaskSampleCsv,
  downloadProjectTaskSampleExcel,
  parseProjectTaskSpreadsheet,
} from "@/lib/project-task-spreadsheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollableText } from "@/components/scrollable-text";
import { cn } from "@/lib/utils";
import {
  BidItemTaskTable,
  type BidItemTaskRow,
} from "@/components/bid-item-task-table";
import { useAdminTable } from "@/hooks/use-admin-table";
import {
  ModalCloseButton,
  UnsavedCloseDialog,
} from "@/components/unsaved-close-dialog";
import { ModalOverlay } from "@/components/modal-overlay";
import type { TaskNode } from "@/types/task-tree";

function ProjectStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const className =
    normalized === "ACTIVE"
      ? "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
      : normalized === "COMPLETED"
        ? "inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200"
        : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200";
  const label =
    normalized === "ACTIVE"
      ? "Active"
      : normalized === "COMPLETED"
        ? "Completed"
        : normalized === "INACTIVE"
          ? "Inactive"
          : status;
  return <span className={className}>{label}</span>;
}

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

const formLabels: Record<string, string> = FORM_TYPE_LABELS;

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const emptyTaskForm = {
  division: "",
  masterBidId: "",
  formType: "STA_WITH_CF",
  beginSta: "",
  endSta: "",
  description: "",
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h3>
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

function workspaceBase(pathname: string): "office" | "system" {
  return pathname.startsWith("/office") ? "office" : "system";
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
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [progressByTaskId, setProgressByTaskId] = useState<
    Map<string, BidItemTaskRow["progress"]>
  >(new Map());

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
          taskTree: TaskNode[];
          units: UnitOpt[];
        }>("/api/v1/projects/lookups"),
      ]);
      setProject(p.project);
      setTaskTree(lookups.taskTree);
      setUnits(lookups.units);

      const progressMap = new Map<string, BidItemTaskRow["progress"]>();
      if (canViewReports) {
        try {
          const wr = await apiFetch<{
            tasks: { id: string; progress: BidItemTaskRow["progress"] }[];
          }>(`/api/v1/workspace-reports/projects/${projectId}`);
          for (const t of wr.tasks) {
            progressMap.set(t.id, t.progress);
          }
        } catch {
          /* progress is optional on project setup */
        }
      }
      setProgressByTaskId(progressMap);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load project");
      navigate(`/${base}/projects`);
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

  const bidItemRows = useMemo((): BidItemTaskRow[] => {
    const filtered =
      divisionFilter === "ALL"
        ? taskRows
        : taskRows.filter((row) => row.division === divisionFilter);

    return filtered.map((row) => ({
      id: row.id,
      taskMasterId: row.taskMasterId,
      assignedTo:
        row.fieldPerson !== "—"
          ? { name: row.fieldPerson, email: "" }
          : null,
      taskMaster: {
        code: row.code,
        name: row.name,
        unit: row.unit,
        formType: row.formType,
      },
      progress: progressByTaskId.get(row.id) ?? {
        estimated: 0,
        approved: 0,
        pending: 0,
        approvedPct: 0,
      },
    }));
  }, [taskRows, divisionFilter, progressByTaskId]);

  const taskSortAccessors = useMemo(
    () => ({
      code: (row: BidItemTaskRow) => row.taskMaster.code,
      name: (row: BidItemTaskRow) => row.taskMaster.name,
      unit: (row: BidItemTaskRow) => row.taskMaster.unit,
      planQty: (row: BidItemTaskRow) => row.progress.estimated,
      installed: (row: BidItemTaskRow) => row.progress.approved,
      progress: (row: BidItemTaskRow) => {
        const { estimated, approved, pending } = row.progress;
        const reported = approved + pending;
        if (estimated > 0) return reported / estimated;
        return reported;
      },
      lead: (row: BidItemTaskRow) => row.assignedTo?.name ?? "",
    }),
    [],
  );

  const tasksTable = useAdminTable({
    rows: bidItemRows,
    getSearchText: (row) =>
      `${row.taskMaster.code} ${row.taskMaster.name} ${row.assignedTo?.name ?? ""}`,
    sortAccessors: taskSortAccessors,
    defaultSort: { key: "code", direction: "asc" },
  });

  useEffect(() => {
    tasksTable.setPage(1);
  }, [divisionFilter, tasksTable.setPage]);

  const projectDivisions = useMemo(
    () =>
      project && project.divisions.length > 0
        ? project.divisions
        : project
          ? [project.division]
          : [],
    [project],
  );

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
      adminNeedsStaWorkLimits({
        formType: selectedMaster.formType,
        masterCode: selectedMaster.code,
        masterName: selectedMaster.name,
      }),
  );

  const showStaWorkLimits = Boolean(
    selectedMaster &&
      adminNeedsStaWorkLimits({
        formType: form.formType,
        masterCode: selectedMaster.code,
        masterName: selectedMaster.name,
      }),
  );

  const fieldEntryPreview = useMemo(() => {
    if (!selectedMaster) return null;
    return adminFieldEntryPreview({
      formType: selectedMaster.formType,
      division: selectedMaster.division ?? form.division,
      unit: selectedMaster.unit,
      masterCode: selectedMaster.code,
      masterName: selectedMaster.name,
    });
  }, [selectedMaster, form.division]);

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
      formType: "STA_WITH_CF",
      beginSta: "",
      endSta: "",
    }));
  }

  function onMasterBidChange(id: string) {
    const master = taskTree.find((m) => m.id === id);
    setForm((f) => ({
      ...f,
      masterBidId: id,
      formType: master?.formType ?? "STA_WITH_CF",
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
      const masterFormType = master?.formType ?? form.formType;
      const needsSta =
        master &&
        adminNeedsStaWorkLimits({
          formType: masterFormType,
          masterCode: master.code,
          masterName: master.name,
        });
      const raw = {
        taskMasterId: form.masterBidId,
        division: form.division,
        formType: needsSta ? masterFormType : "SINGLE_POINT",
        beginSta: needsSta ? form.beginSta.trim() || null : null,
        endSta: needsSta ? form.endSta.trim() || null : null,
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

  const projectMeta = [
    project.projectType?.name,
    projectDivisions.map((d) => divisionLabels[d] ?? d).join(", "),
    project.location,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
        <Link
          to={`/${base}/projects`}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">Projects</span>
        </Link>

        <div
          className="hidden h-5 w-px shrink-0 bg-border md:block"
          aria-hidden
        />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {project.jobNumber}
          </span>
          <ScrollableText
            maxHeight="max-h-16"
            className="min-w-0 flex-1 text-base font-semibold tracking-tight sm:text-lg"
          >
            {project.name}
          </ScrollableText>
          <ProjectStatusBadge status={project.status} />
          {projectMeta ? (
            <span
              className="hidden min-w-0 truncate text-xs text-muted-foreground lg:inline"
              title={projectMeta}
            >
              · {projectMeta}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canViewReports && isProjectAdminWorkspace && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/${base}/reports/history?projectId=${project.id}`}>
                Approval history
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import tasks
          </Button>
          <Button
            size="sm"
            className="bg-asphalt-mid text-white hover:bg-asphalt"
            onClick={openCreate}
          >
            <Plus className="size-4" /> Add task
          </Button>
        </div>
      </div>

      <BidItemTaskTable
        projectId={project.id}
        base={base}
        tasks={bidItemRows}
        totalTasksCount={taskRows.length}
        table={tasksTable}
        saving={saving}
        showViewEntries={false}
        onRemove={(taskMasterId) => void removeTask(taskMasterId)}
        toolbarExtra={
          <select
            className={cn(
              selectClass,
              "h-9 w-auto min-w-[9.5rem] shrink-0 px-2.5 text-sm",
            )}
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
          >
            <option value="ALL">All divisions</option>
            {Object.entries(divisionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        }
        emptyMessage={
          <>
            No tasks yet. Click <strong>Add task</strong> or{" "}
            <strong>Import tasks</strong> to add work scope.
          </>
        }
        filteredEmptyMessage="No tasks match your search or filter."
      />

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
                Select a master bid to add to this project.
                {showStaWorkLimits
                  ? " Set Begin/End STA work limits for this task."
                  : fieldEntryPreview
                    ? " Quantities are entered by location in the field app."
                    : null}
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
            <FormSection title="Assignment">
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
                    {showStaWorkLimits
                      ? formLabels.STA_RANGE
                      : fieldEntryPreview
                        ? formLabels.SINGLE_LOCATION
                        : formLabels[selectedMaster.formType] ??
                          selectedMaster.formType}
                  </p>
                ) : null}
              </FormField>

            </FormSection>

            {showStaWorkLimits && (
              <FormSection title="Work limits">
                <FormField>
                  <Label>Begin STA *</Label>
                  <Input
                    value={form.beginSta}
                    required
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        beginSta: sanitizeStaInput(e.target.value),
                      }))
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
                      setForm((f) => ({
                        ...f,
                        endSta: sanitizeStaInput(e.target.value),
                      }))
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

            {fieldEntryPreview && (
              <FormSection title={fieldEntryPreview.title}>
                <ul className="sm:col-span-2 space-y-2 text-sm text-muted-foreground">
                  {fieldEntryPreview.fields.map((field) => (
                    <li key={field} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lane" />
                      {field}
                    </li>
                  ))}
                </ul>
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  Assign the task here — the field lead fills in these details on
                  each daily report.
                </p>
              </FormSection>
            )}

            <FormSection title="Notes">
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

      <ModalOverlay
        open={importOpen}
        onBackdropClick={() => {
          setImportOpen(false);
          setImportFile(null);
        }}
      >
          <div
            className="relative z-[2001] w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
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
      </ModalOverlay>
    </div>
  );
}
