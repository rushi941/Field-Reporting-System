import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RouteMapPicker,
  type RouteValue,
} from "@/components/route-map-picker";

type ProjectTypeOpt = { id: string; code: string; name: string };
type ManagerOpt = { id: string; name: string; email: string };
type Project = {
  id: string;
  jobNumber: string;
  name: string;
  division: string;
  divisions: string[];
  projectTypeId: string | null;
  projectType: ProjectTypeOpt | null;
  projectManagerId: string | null;
  projectManager: { id: string; name: string; email: string } | null;
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
};

const emptyForm = {
  jobNumber: "",
  name: "",
  division: "PAVEMENT_MARKING",
  projectTypeId: "",
  projectManagerId: "",
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

const statuses = ["ACTIVE", "INACTIVE", "COMPLETED"] as const;

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function workspaceBase(pathname: string) {
  return pathname.startsWith("/office") ? "/office" : "/system";
}

export function ProjectsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const base = workspaceBase(location.pathname);

  const [projects, setProjects] = useState<Project[]>([]);
  const [types, setTypes] = useState<ProjectTypeOpt[]>([]);
  const [managers, setManagers] = useState<ManagerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [routeDraft, setRouteDraft] = useState<RouteValue | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, lookups] = await Promise.all([
        apiFetch<{ projects: Project[] }>("/api/v1/projects"),
        apiFetch<{
          projectTypes: ProjectTypeOpt[];
          managers: ManagerOpt[];
        }>("/api/v1/projects/lookups"),
      ]);
      setProjects(p.projects);
      setTypes(lookups.projectTypes);
      setManagers(lookups.managers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setRouteDraft(null);
    setOpen(true);
  }

  function openEdit(p: Project) {
    setEditingId(p.id);
    setForm({
      jobNumber: p.jobNumber,
      name: p.name,
      division: p.division,
      projectTypeId: p.projectTypeId ?? "",
      projectManagerId: p.projectManagerId ?? "",
      clientName: p.clientName ?? "",
      generalContractor: p.generalContractor ?? "",
      location: p.location ?? "",
      contractAmount: p.contractAmount != null ? String(p.contractAmount) : "",
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
      notes: p.notes ?? "",
      status: p.status,
    });
    setRouteDraft(p.route);
    setOpen(true);
  }

  function openDetail(id: string) {
    navigate(`${base}/projects/${id}`);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectManagerId) {
      toast.error("Select a project manager", { id: "project-form" });
      return;
    }
    if (!routeDraft) {
      toast.error("Pin work route A → B on the map", { id: "project-form" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        jobNumber: form.jobNumber,
        name: form.name,
        division: form.division,
        projectTypeId: form.projectTypeId || null,
        projectManagerId: form.projectManagerId || null,
        clientName: form.clientName || null,
        generalContractor: form.generalContractor || null,
        location: form.location || null,
        contractAmount: form.contractAmount ? Number(form.contractAmount) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        notes: form.notes || null,
        status: form.status,
        route: routeDraft,
        taskIds: [] as string[],
      };
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
        setOpen(false);
        await load();
        navigate(`${base}/projects/${created.project.id}`);
        return;
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed", {
        id: "project-form",
      });
    } finally {
      setSaving(false);
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
            Create a project with PM, division, and work route A → B
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
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Job #</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Division</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Manager</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() => openDetail(p.id)}
                  >
                    <td className="px-4 py-3 font-medium">{p.jobNumber}</td>
                    <td className="px-4 py-3">
                      <div>{p.name}</div>
                      {p.location && (
                        <div className="text-xs text-muted-foreground">{p.location}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {divisionLabels[p.division] ?? p.division}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.route ? "Pinned" : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.projectManager?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">{p.status}</td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit project"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black/45 p-4">
          <form
            onSubmit={onSave}
            className="relative z-[2001] max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit project" : "New project"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set PM, division, job details, and pin the work route (A → B) on
              the map.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Job number</Label>
                <Input
                  value={form.jobNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, jobNumber: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
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
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Project name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
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
              </div>
              <div className="space-y-1.5">
                <Label>Division</Label>
                <select
                  className={selectClass}
                  value={form.division}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, division: e.target.value }))
                  }
                >
                  {Object.entries(divisionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Project manager *</Label>
                <select
                  className={selectClass}
                  value={form.projectManagerId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, projectManagerId: e.target.value }))
                  }
                  required
                >
                  <option value="">— Select PM —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Client / owner</Label>
                <Input
                  value={form.clientName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, clientName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>General contractor</Label>
                <Input
                  value={form.generalContractor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, generalContractor: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Contract amount</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.contractAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contractAmount: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Notes</Label>
                <textarea
                  className="min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-5 space-y-2 border-t border-border pt-4">
              <div>
                <Label>Work route *</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Search or click the map to set start (A) and end (B)
                </p>
              </div>
              <RouteMapPicker value={routeDraft} onChange={setRouteDraft} />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-asphalt-mid text-white hover:bg-asphalt"
                disabled={saving}
              >
                {saving ? "Saving…" : editingId ? "Save" : "Create project"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
