import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UnitRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export function UnitsPage() {
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UnitRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", isActive: true });

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ units: UnitRow[] }>("/api/v1/units");
      setRows(data.units);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load units");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ code: "", name: "", isActive: true });
    setOpen(true);
  }

  function openEdit(row: UnitRow) {
    setEditingId(row.id);
    setForm({ code: row.code, name: row.name, isActive: row.isActive });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        isActive: form.isActive,
      };
      if (editingId) {
        await apiFetch(`/api/v1/units/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Unit updated");
      } else {
        await apiFetch("/api/v1/units", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Unit created");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/units/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`Deleted unit ${deleteTarget.code}`);
      setDeleteTarget(null);
      await load();
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
            Masters
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Units
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Used as the Unit dropdown on Bid master. Deactivate to hide from new
            bids without deleting history.
          </p>
        </div>
        <Button
          className="bg-asphalt-mid text-white hover:bg-asphalt"
          onClick={openCreate}
        >
          <Plus className="size-4" /> Add unit
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No units yet. Add LF, EA, and other codes used on bids.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete unit"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
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
              {editingId ? "Edit unit" : "New unit"}
            </h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="LF"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Linear Feet"
                  required
                />
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
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-asphalt-mid text-white hover:bg-asphalt"
                disabled={saving}
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Create"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Delete unit?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget.code} — {deleteTarget.name}
              </span>
              ? This cannot be undone.
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
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
