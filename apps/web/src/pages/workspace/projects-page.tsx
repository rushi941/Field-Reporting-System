import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { projectSchema, splitProjectDivisions, billingRelationshipLabels, billingRelationshipDescriptions, type BillingRelationship } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { firstZodIssueMessage } from "@/lib/zod-error";
import { Button } from "@/components/ui/button";
import { ActivityDot } from "@/components/activity-dot";
import { useAuth } from "@/auth/auth-context";
import { isProjectNew, markProjectsKnown, getKnownProjectIds } from "@/lib/activity-seen";
import { useActivitySeenRevision } from "@/hooks/use-activity-seen-revision";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { showFullPageLoader } from "@/lib/page-load";
import { TablePagination } from "@/components/table-pagination";
import { ADMIN_PAGE_SIZE, paginateSlice } from "@/lib/admin-table";
import {
  ModalCloseButton,
  UnsavedCloseDialog,
} from "@/components/unsaved-close-dialog";
import { DivisionMultiSelect } from "@/components/division-multi-select";
import { UserMultiSelect } from "@/components/user-multi-select";
import { ClientSuggestInput } from "@/components/client-suggest-input";

type ProjectTypeOpt = { id: string; code: string; name: string };
type ClientOpt = {
  id: string;
  name: string;
  foundationNumber?: number | null;
};
type ManagerOpt = {
  id: string;
  name: string;
  email: string;
  division?: string | null;
  roles?: string[];
};
type Project = {
  id: string;
  jobNumber: string;
  name: string;
  division: string;
  divisions: string[];
  projectTypeId: string | null;
  projectType: ProjectTypeOpt | null;
  projectAdminId: string | null;
  projectAdmin: { id: string; name: string; email: string } | null;
  projectManagerId: string | null;
  projectManager: { id: string; name: string; email: string } | null;
  fieldLeadIds?: string[];
  fieldLeads?: { id: string; name: string; email: string }[];
  divisionManagerIds?: string[];
  divisionManagers?: { id: string; name: string; email: string }[];
  clientName: string | null;
  generalContractor: string | null;
  billingRelationship: BillingRelationship;
  location: string | null;
  contractAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  status: string;
  bidItemCount: number;
  taskIds: string[];
  createdAt?: string;
};

const emptyForm = {
  jobNumber: "",
  name: "",
  selectedDivisions: ["PAVEMENT_MARKING"] as string[],
  projectTypeId: "",
  projectAdminId: "",
  fieldLeadIds: [] as string[],
  divisionManagerIds: [] as string[],
  clientName: "",
  generalContractor: "",
  billingRelationship: "DIRECT_CLIENT" as BillingRelationship,
  location: "",
  contractAmount: "",
  startDate: "",
  endDate: "",
  notes: "",
  status: "ACTIVE",
};

const divisionLabels: Record<string, string> = {
  PAVEMENT_MARKING: "Pavement Marking",
  TRAFFIC_CONTROL: "Traffic Control",
  PERMANENT_SIGNS: "Permanent Signs",
  MISCELLANEOUS: "Miscellaneous",
};

const divisionOptions = Object.entries(divisionLabels).map(([value, label]) => ({
  value,
  label,
}));

function formatDivisions(divisions: string[]) {
  return divisions.map((d) => divisionLabels[d] ?? d).join(", ");
}

function isProjectUnread(
  userId: string | undefined,
  project: Pick<Project, "id" | "projectAdminId">,
): boolean {
  if (!userId) return false;
  if (project.projectAdminId === userId) return false;
  return isProjectNew(userId, project.id);
}

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

const statuses = ["ACTIVE", "INACTIVE", "COMPLETED"] as const;

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const inputClass = "h-11 text-sm";

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
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">{children}</div>
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

function createEmptyForm(projectAdminId = "") {
  return { ...emptyForm, projectAdminId };
}

export function ProjectsPage() {
  const { user } = useAuth();
  useActivitySeenRevision("known_projects");
  const location = useLocation();
  const navigate = useNavigate();
  const base = workspaceBase(location.pathname);
  const isOfficeWorkspace = base === "/office";
  const isSystemAdmin = user?.roles.includes("SYSTEM_ADMIN") ?? false;
  const lockProjectAdmin =
    isOfficeWorkspace &&
    (user?.roles.includes("PROJECT_ADMIN") ?? false) &&
    !isSystemAdmin;
  const lockedProjectAdminName = user
    ? `${user.firstName} ${user.lastName}`
    : "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [types, setTypes] = useState<ProjectTypeOpt[]>([]);
  const [projectAdmins, setProjectAdmins] = useState<ManagerOpt[]>([]);
  const [divisionManagers, setDivisionManagers] = useState<ManagerOpt[]>([]);
  const [fieldLeads, setFieldLeads] = useState<ManagerOpt[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formBaseline, setFormBaseline] = useState("");
  const [unsavedPrompt, setUnsavedPrompt] = useState(false);
  const [page, setPage] = useState(1);

  function snapshotForm(nextForm: typeof emptyForm) {
    return JSON.stringify(nextForm);
  }

  const isDirty =
    open && formBaseline !== "" && snapshotForm(form) !== formBaseline;

  const paginatedProjects = useMemo(
    () => paginateSlice(projects, page, ADMIN_PAGE_SIZE),
    [projects, page],
  );

  async function load(background = false) {
    if (!background) setLoading(true);
    try {
      const [p, lookups] = await Promise.all([
        apiFetch<{ projects: Project[] }>("/api/v1/projects"),
        apiFetch<{
          projectTypes: ProjectTypeOpt[];
          projectAdmins: ManagerOpt[];
          divisionManagers: ManagerOpt[];
          fieldLeads: ManagerOpt[];
          clients: ClientOpt[];
        }>("/api/v1/projects/lookups"),
      ]);
      setProjects(p.projects);
      setTypes(lookups.projectTypes);
      setProjectAdmins(lookups.projectAdmins ?? []);
      setDivisionManagers(lookups.divisionManagers ?? []);
      setFieldLeads(lookups.fieldLeads ?? []);
      setClients(lookups.clients ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (projects.length > 0 && user?.id) {
      const known = getKnownProjectIds(user.id);
      if (known.size === 0) {
        markProjectsKnown(
          user.id,
          projects.map((p) => p.id),
        );
      }
    }
  }, [projects, user?.id]);

  function openCreate() {
    setEditingId(null);
    const nextForm = createEmptyForm(
      lockProjectAdmin && user?.id ? user.id : "",
    );
    setForm(nextForm);
    setFormBaseline(snapshotForm(nextForm));
    setUnsavedPrompt(false);
    setOpen(true);
  }

  function openEdit(p: Project) {
    setEditingId(p.id);
    const nextForm = {
      jobNumber: p.jobNumber,
      name: p.name,
      selectedDivisions:
        p.divisions.length > 0 ? p.divisions : [p.division],
      projectTypeId: p.projectTypeId ?? "",
      projectAdminId:
        p.projectAdminId ??
        (lockProjectAdmin && user?.id ? user.id : ""),
      fieldLeadIds:
        p.fieldLeadIds ??
        p.fieldLeads?.map((u) => u.id) ??
        [],
      divisionManagerIds:
        p.divisionManagerIds ??
        p.divisionManagers?.map((u) => u.id) ??
        (p.projectManagerId ? [p.projectManagerId] : []),
      clientName: p.clientName ?? "",
      generalContractor: p.generalContractor ?? "",
      billingRelationship: p.billingRelationship ?? "DIRECT_CLIENT",
      location: p.location ?? "",
      contractAmount: p.contractAmount != null ? String(p.contractAmount) : "",
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
      notes: p.notes ?? "",
      status: p.status,
    };
    setForm(nextForm);
    setFormBaseline(snapshotForm(nextForm));
    setUnsavedPrompt(false);
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setUnsavedPrompt(false);
    setFormBaseline("");
  }

  function requestCloseForm() {
    if (saving) return;
    if (isDirty) {
      setUnsavedPrompt(true);
      return;
    }
    closeForm();
  }

  function openDetail(id: string) {
    markProjectsKnown(user?.id, [id]);
    navigate(`${base}/projects/${id}`);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (form.selectedDivisions.length === 0) {
      toast.error("Select at least one division", { id: "project-form" });
      return;
    }
    if (form.fieldLeadIds.length === 0) {
      toast.error("Select at least one field person", { id: "project-form" });
      return;
    }
    if (form.divisionManagerIds.length === 0) {
      toast.error("Select at least one division manager", { id: "project-form" });
      return;
    }
    setSaving(true);
    try {
      const { division, divisions } = splitProjectDivisions(
        form.selectedDivisions as Array<
          "PAVEMENT_MARKING" | "TRAFFIC_CONTROL" | "PERMANENT_SIGNS"
        >,
      );
      const projectAdminId =
        lockProjectAdmin && user?.id ? user.id : form.projectAdminId;
      const raw = {
        jobNumber: form.jobNumber.trim(),
        name: form.name.trim(),
        division,
        divisions,
        projectTypeId: form.projectTypeId || null,
        projectAdminId,
        fieldLeadIds: form.fieldLeadIds,
        divisionManagerIds: form.divisionManagerIds,
        clientName: form.clientName.trim() || null,
        generalContractor: form.generalContractor.trim() || null,
        billingRelationship: form.billingRelationship,
        location: form.location.trim() || null,
        contractAmount: form.contractAmount ? Number(form.contractAmount) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        notes: form.notes.trim() || null,
        status: form.status,
        taskIds: [] as string[],
      };
      const schema = projectSchema;
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        toast.error(firstZodIssueMessage(parsed.error), { id: "project-form" });
        return;
      }
      const payload = parsed.data;
      if (editingId) {
        await apiFetch(`/api/v1/projects/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Project updated", { id: "project-form" });
      } else {
        const created = await apiFetch<{ project: Project }>("/api/v1/projects", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        markProjectsKnown(user?.id, [created.project.id]);
        toast.success("Project created", { id: "project-form" });
        closeForm();
        navigate(`${base}/projects/${created.project.id}`);
        return;
      }
      closeForm();
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed", {
        id: "project-form",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/projects/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setProjects((list) => list.filter((p) => p.id !== deleteTarget.id));
      toast.success(`Deleted ${deleteTarget.jobNumber}`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Projects
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Projects
          </h1>
        </div>
        <Button className="bg-asphalt-mid text-white hover:bg-asphalt" onClick={openCreate}>
          <Plus className="size-4" /> Add project
        </Button>
      </div>

      {showFullPageLoader(loading, projects.length > 0) ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No projects yet. Click <strong>Add project</strong> to create one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">Job #</th>
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Division</th>
                  <th className="px-2 py-1">Project admin</th>
                  <th className="px-2 py-1">Division manager</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.items.map((p) => {
                  const unread = isProjectUnread(user?.id, p);
                  return (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b border-border/80 last:border-0 hover:bg-muted/30"
                    onClick={() => openDetail(p.id)}
                  >
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        {unread && (
                          <ActivityDot inline label="New project" />
                        )}
                        <span>{p.jobNumber}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-foreground">{p.name}</div>
                      {p.location && (
                        <div className="text-xs text-muted-foreground">{p.location}</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-foreground/80">
                      {formatDivisions(
                        p.divisions.length > 0 ? p.divisions : [p.division],
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-foreground/80">
                      {p.projectAdmin?.name ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-foreground/80">
                      {(p.divisionManagers?.length
                        ? p.divisionManagers.map((m) => m.name)
                        : p.projectManager
                          ? [p.projectManager.name]
                          : []
                      ).join(", ") || "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <ProjectStatusBadge status={p.status} />
                    </td>
                    <td
                      className="px-2 py-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit project"
                          aria-label="Edit project"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete project"
                          aria-label="Delete project"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={paginatedProjects.page}
            pageSize={ADMIN_PAGE_SIZE}
            total={paginatedProjects.total}
            onPageChange={setPage}
          />
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-delete-title"
            className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl"
          >
            <h2
              id="project-delete-title"
              className="text-lg font-semibold tracking-tight"
            >
              Delete project?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget.jobNumber} — {deleteTarget.name}
              </span>
              ? All tasks, field assignments, and reports on this job will be
              removed. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <UnsavedCloseDialog
        open={unsavedPrompt}
        saving={saving}
        onStay={() => setUnsavedPrompt(false)}
        onDiscard={closeForm}
        onSave={() => {
          setUnsavedPrompt(false);
          const formEl = document.getElementById(
            "project-form-modal",
          ) as HTMLFormElement | null;
          formEl?.requestSubmit();
        }}
      />

      {open && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black/45 p-4">
          <form
            id="project-form-modal"
            onSubmit={onSave}
            className="relative z-[2001] max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-xl border bg-card p-6 shadow-xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {editingId ? "Edit project" : "New project"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter job details and assign the team.
                </p>
              </div>
              <ModalCloseButton onClick={requestCloseForm} disabled={saving} />
            </div>

            <div className="mt-6 space-y-5">
              <FormSection
                title="Basic information"
                description="Core job identity and status"
              >
                <FormField>
                  <Label>Job number *</Label>
                  <Input
                    className={inputClass}
                    value={form.jobNumber}
                    placeholder="e.g. JOB-2026-0142"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, jobNumber: e.target.value }))
                    }
                    required
                  />
                </FormField>
                <FormField>
                  <Label>Status</Label>
                  <select
                    className={selectClass}
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField>
                  <Label>Project name *</Label>
                  <Input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField>
                  <Label>Project type</Label>
                  <select
                    className={selectClass}
                    value={form.projectTypeId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, projectTypeId: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {t.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField>
                  <Label>Divisions *</Label>
                  <p className="text-xs text-muted-foreground">
                    Select one or more
                  </p>
                  <DivisionMultiSelect
                    value={form.selectedDivisions}
                    onChange={(selectedDivisions) =>
                      setForm((f) => ({ ...f, selectedDivisions }))
                    }
                    options={divisionOptions}
                    disabled={saving}
                  />
                </FormField>
              </FormSection>

              <FormSection
                title="Team & assignments"
                description="Who manages and works this job in the field"
              >
                {lockProjectAdmin ? (
                  <FormField>
                    <Label>Project admin</Label>
                    <Input
                      value={lockedProjectAdminName}
                      readOnly
                      className={cn(inputClass, "bg-muted/50")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Assigned as project admin for new projects.
                    </p>
                  </FormField>
                ) : (
                  <FormField>
                    <Label>Project admin *</Label>
                    <select
                      className={selectClass}
                      value={form.projectAdminId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, projectAdminId: e.target.value }))
                      }
                      required
                    >
                      <option value="">— Select project admin —</option>
                      {projectAdmins.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                )}
                <FormField>
                  <Label>Division managers *</Label>
                  <p className="text-xs text-muted-foreground">
                    One or more for approvals
                  </p>
                  <UserMultiSelect
                    value={form.divisionManagerIds}
                    onChange={(divisionManagerIds) =>
                      setForm((f) => ({ ...f, divisionManagerIds }))
                    }
                    options={divisionManagers.map((m) => ({
                      id: m.id,
                      name: m.name,
                      hint: m.division
                        ? divisionLabels[m.division] ?? m.division
                        : undefined,
                    }))}
                    placeholder="Select division managers"
                    minSelected={1}
                    disabled={saving}
                  />
                </FormField>
                <FormField>
                  <Label>Field persons *</Label>
                  <p className="text-xs text-muted-foreground">
                    Field leads on this job
                  </p>
                  <UserMultiSelect
                    value={form.fieldLeadIds}
                    onChange={(fieldLeadIds) =>
                      setForm((f) => ({ ...f, fieldLeadIds }))
                    }
                    options={fieldLeads.map((m) => ({
                      id: m.id,
                      name: m.name,
                      hint: m.division
                        ? divisionLabels[m.division] ?? m.division
                        : undefined,
                    }))}
                    placeholder="Select field persons"
                    minSelected={1}
                    disabled={saving}
                  />
                </FormField>
              </FormSection>

              <FormSection
                title="Project details"
                description="Billing relationship, client, schedule, and contract"
              >
                <FormField className="sm:col-span-2">
                  <Label>Billing / work type</Label>
                  <select
                    className={selectClass}
                    value={form.billingRelationship}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        billingRelationship: e.target
                          .value as BillingRelationship,
                      }))
                    }
                    disabled={saving}
                  >
                    {(Object.entries(billingRelationshipLabels) as [
                      BillingRelationship,
                      string,
                    ][]).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {billingRelationshipDescriptions[form.billingRelationship]}
                  </p>
                </FormField>
                {(form.billingRelationship === "DIRECT_CLIENT" ||
                  form.billingRelationship === "CLIENT_AND_GC") && (
                  <FormField>
                    <Label>
                      Client / owner
                      {form.billingRelationship !== "GC_DIRECT" ? " *" : ""}
                    </Label>
                    <ClientSuggestInput
                      className={inputClass}
                      value={form.clientName}
                      onChange={(clientName) =>
                        setForm((f) => ({ ...f, clientName }))
                      }
                      options={clients}
                      placeholder="Client or owner name"
                      disabled={saving}
                    />
                  </FormField>
                )}
                {form.billingRelationship === "GC_DIRECT" && (
                  <FormField>
                    <Label>End client (optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Owner or agency if known — not required for direct GC work
                    </p>
                    <ClientSuggestInput
                      className={inputClass}
                      value={form.clientName}
                      onChange={(clientName) =>
                        setForm((f) => ({ ...f, clientName }))
                      }
                      options={clients}
                      placeholder="Optional end client"
                      disabled={saving}
                    />
                  </FormField>
                )}
                {form.billingRelationship !== "DIRECT_CLIENT" && (
                  <FormField>
                    <Label>
                      General contractor
                      {form.billingRelationship !== "DIRECT_CLIENT" ? " *" : ""}
                    </Label>
                    <ClientSuggestInput
                      className={inputClass}
                      value={form.generalContractor}
                      onChange={(generalContractor) =>
                        setForm((f) => ({ ...f, generalContractor }))
                      }
                      options={clients}
                      placeholder="General contractor name"
                      disabled={saving}
                    />
                  </FormField>
                )}
                <FormField>
                  <Label>Location</Label>
                  <Input
                    className={inputClass}
                    value={form.location}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, location: e.target.value }))
                    }
                  />
                </FormField>
                <FormField>
                  <Label>Contract amount</Label>
                  <Input
                    className={inputClass}
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.contractAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contractAmount: e.target.value }))
                    }
                  />
                </FormField>
                <FormField>
                  <Label>Start date</Label>
                  <Input
                    className={inputClass}
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                  />
                </FormField>
                <FormField>
                  <Label>End date</Label>
                  <Input
                    className={inputClass}
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                  />
                </FormField>
                <FormField className="col-span-2">
                  <Label>Notes</Label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                  />
                </FormField>
              </FormSection>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={requestCloseForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-asphalt-mid text-white hover:bg-asphalt"
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Create project"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
