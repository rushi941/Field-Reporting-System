import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { projectSchema, updateProjectSchema, splitProjectDivisions } from "@frs/shared";
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
import {
  RouteMapPicker,
  type RouteValue,
} from "@/components/route-map-picker";
import {
  ModalCloseButton,
  UnsavedCloseDialog,
} from "@/components/unsaved-close-dialog";
import { DivisionMultiSelect } from "@/components/division-multi-select";
import { UserMultiSelect } from "@/components/user-multi-select";

type ProjectTypeOpt = { id: string; code: string; name: string };
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
  location: string | null;
  contractAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  status: string;
  bidItemCount: number;
  taskIds: string[];
  route: RouteValue | null;
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
};

const divisionOptions = Object.entries(divisionLabels).map(([value, label]) => ({
  value,
  label,
}));

function formatDivisions(divisions: string[]) {
  return divisions.map((d) => divisionLabels[d] ?? d).join(", ");
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
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [routeDraft, setRouteDraft] = useState<RouteValue | null>(null);
  const [formBaseline, setFormBaseline] = useState("");
  const [unsavedPrompt, setUnsavedPrompt] = useState(false);

  function snapshotForm(nextForm: typeof emptyForm, nextRoute: RouteValue | null) {
    return JSON.stringify({ form: nextForm, route: nextRoute });
  }

  const isDirty =
    open && formBaseline !== "" && snapshotForm(form, routeDraft) !== formBaseline;

  async function load() {
    setLoading(true);
    try {
      const [p, lookups] = await Promise.all([
        apiFetch<{ projects: Project[] }>("/api/v1/projects"),
        apiFetch<{
          projectTypes: ProjectTypeOpt[];
          projectAdmins: ManagerOpt[];
          divisionManagers: ManagerOpt[];
          fieldLeads: ManagerOpt[];
        }>("/api/v1/projects/lookups"),
      ]);
      setProjects(p.projects);
      setTypes(lookups.projectTypes);
      setProjectAdmins(lookups.projectAdmins ?? []);
      setDivisionManagers(lookups.divisionManagers ?? []);
      setFieldLeads(lookups.fieldLeads ?? []);
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
    setRouteDraft(null);
    setFormBaseline(snapshotForm(nextForm, null));
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
      location: p.location ?? "",
      contractAmount: p.contractAmount != null ? String(p.contractAmount) : "",
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
      notes: p.notes ?? "",
      status: p.status,
    };
    setForm(nextForm);
    setRouteDraft(p.route);
    setFormBaseline(snapshotForm(nextForm, p.route));
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
        location: form.location.trim() || null,
        contractAmount: form.contractAmount ? Number(form.contractAmount) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        notes: form.notes.trim() || null,
        status: form.status,
        route: routeDraft ?? null,
        taskIds: [] as string[],
      };
      const schema = editingId ? updateProjectSchema : projectSchema;
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
        toast.success("Project created", { id: "project-form" });
        closeForm();
        await load();
        navigate(`${base}/projects/${created.project.id}`);
        return;
      }
      closeForm();
      await load();
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
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a project with project admin, division manager, and work route A → B
          </p>
        </div>
        <Button className="bg-asphalt-mid text-white hover:bg-asphalt" onClick={openCreate}>
          <Plus className="size-4" /> Add project
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Job #</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Division</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Project admin</th>
                  <th className="px-4 py-3">Division manager</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const unread = isProjectNew(user?.id, p.id);
                  return (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() => openDetail(p.id)}
                  >
                    <td className="px-4 py-3 font-medium">
                      <span className="relative inline-flex items-center">
                        {unread && (
                          <ActivityDot className="-left-2 top-1/2 -translate-y-1/2" />
                        )}
                        <span className={unread ? "pl-2" : undefined}>
                          {p.jobNumber}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>{p.name}</div>
                      {p.location && (
                        <div className="text-xs text-muted-foreground">{p.location}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {formatDivisions(
                        p.divisions.length > 0 ? p.divisions : [p.division],
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.route ? "Pinned" : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.projectAdmin?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(p.divisionManagers?.length
                        ? p.divisionManagers.map((m) => m.name)
                        : p.projectManager
                          ? [p.projectManager.name]
                          : []
                      ).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">{p.status}</td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit project"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete project"
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
                  Enter job details, assign the team, and optionally pin the work route.
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
                description="Client, schedule, and contract information"
              >
                <FormField>
                  <Label>Client / owner</Label>
                  <Input
                    className={inputClass}
                    value={form.clientName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, clientName: e.target.value }))
                    }
                  />
                </FormField>
                <FormField>
                  <Label>General contractor</Label>
                  <Input
                    className={inputClass}
                    value={form.generalContractor}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, generalContractor: e.target.value }))
                    }
                  />
                </FormField>
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

              <section className="rounded-xl border border-border bg-muted/15 p-5">
                <div className="mb-4 border-b border-border pb-3">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Work route
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional — search or click the map to set start (A) and end (B)
                  </p>
                </div>
                <RouteMapPicker value={routeDraft} onChange={setRouteDraft} />
              </section>
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
