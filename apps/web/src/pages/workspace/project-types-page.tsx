import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProjectType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  division: string | null;
  isActive: boolean;
  projectCount: number;
  taskCount: number;
};

const divisions = [
  { value: "", label: "— Any —" },
  { value: "PAVEMENT_MARKING", label: "Pavement Marking" },
  { value: "TRAFFIC_CONTROL", label: "Traffic Control" },
  { value: "PERMANENT_SIGNS", label: "Permanent Signs" },
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ProjectTypesPage() {
  const [rows, setRows] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    division: "",
    isActive: true,
  });

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ projectTypes: ProjectType[] }>(
        "/api/v1/project-types",
      );
      setRows(data.projectTypes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load types");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ code: "", name: "", description: "", division: "", isActive: true });
    setOpen(true);
  }

  function openEdit(row: ProjectType) {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      division: row.division ?? "",
      isActive: row.isActive,
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        division: form.division || null,
        isActive: form.isActive,
      };
      if (editingId) {
        await apiFetch(`/api/v1/project-types/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Project type updated");
      } else {
        await apiFetch("/api/v1/project-types", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Project type created");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Masters
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Project types
          </h1>
        </div>
        <Button className="bg-asphalt-mid text-white hover:bg-asphalt" onClick={openCreate}>
          <Plus className="size-4" /> Add type
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Division</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">
                    <div>{r.name}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{r.division ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.projectCount} projects · {r.taskCount} bids
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Pencil className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form
            onSubmit={onSave}
            className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit project type" : "New project type"}
            </h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
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
                  {divisions.map((d) => (
                    <option key={d.value || "any"} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                Active
              </label>
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
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
