import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { roles, roleLabels, type AppRole } from "@frs/shared";
import { apiFetch, type ManagedUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  isActive: boolean;
  roles: AppRole[];
};

const emptyForm: FormState = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
  isActive: true,
  roles: ["FIELD_LEAD"],
};

export function SystemUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<ManagedUser | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const title = useMemo(
    () => (editingId ? "Edit user" : "New user"),
    [editingId],
  );

  async function load() {
    setLoading(true);
    try {
      const u = await apiFetch<{ users: ManagedUser[] }>("/api/v1/users");
      setUsers(u.users);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
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
    setOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setEditingId(user.id);
    setForm({
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? "",
      isActive: user.isActive,
      roles: user.roles as AppRole[],
    });
    setOpen(true);
  }

  function toggleRole(role: AppRole) {
    setForm((prev) => {
      const has = prev.roles.includes(role);
      const next = has
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles: next.length ? next : prev.roles };
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || null,
        isActive: form.isActive,
        roles: form.roles,
        ...(form.password ? { password: form.password } : {}),
      };

      if (editingId) {
        await apiFetch(`/api/v1/users/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("User updated successfully");
      } else {
        if (!form.password) {
          toast.error("Password is required");
          setSaving(false);
          return;
        }
        await apiFetch("/api/v1/users", {
          method: "POST",
          body: JSON.stringify({ ...payload, password: form.password }),
        });
        toast.success("User created successfully");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  }

  async function confirmToggleActive() {
    if (!statusConfirm || togglingId) return;
    const user = statusConfirm;
    const next = !user.isActive;
    setTogglingId(user.id);
    try {
      await apiFetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setUsers((list) =>
        list.map((u) => (u.id === user.id ? { ...u, isActive: next } : u)),
      );
      setStatusConfirm(null);
      toast.success(
        next
          ? `${user.firstName} ${user.lastName} is now active`
          : `${user.firstName} ${user.lastName} is now inactive`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update status",
      );
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Configuration
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Users
          </h1>
        </div>
        <Button
          className="bg-asphalt-mid text-white hover:bg-asphalt"
          onClick={openCreate}
        >
          <Plus className="size-4" />
          Add user
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/80 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-foreground">
                        {u.firstName} {u.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-foreground/80">
                      {u.roles
                        .map((r) => roleLabels[r as AppRole] ?? r)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        disabled={togglingId === u.id}
                        onClick={() => setStatusConfirm(u)}
                        title="Click to change active status"
                        className={
                          u.isActive
                            ? "inline-flex cursor-pointer rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-60"
                            : "inline-flex cursor-pointer rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-200 disabled:opacity-60"
                        }
                      >
                        {togglingId === u.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : u.isActive ? (
                          "Active"
                        ) : (
                          "Inactive"
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(u)}
                          aria-label="Edit"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {statusConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-confirm-title"
            className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl"
          >
            <h2
              id="status-confirm-title"
              className="text-lg font-semibold tracking-tight"
            >
              {statusConfirm.isActive
                ? "Deactivate user?"
                : "Activate user?"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {statusConfirm.isActive
                ? `Are you sure you want to deactivate ${statusConfirm.firstName} ${statusConfirm.lastName}?`
                : `Are you sure you want to activate ${statusConfirm.firstName} ${statusConfirm.lastName}?`}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={togglingId === statusConfirm.id}
                onClick={() => setStatusConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={
                  statusConfirm.isActive
                    ? "bg-slate-700 text-white hover:bg-slate-800"
                    : "bg-asphalt-mid text-white hover:bg-asphalt"
                }
                disabled={togglingId === statusConfirm.id}
                onClick={() => void confirmToggleActive()}
              >
                {togglingId === statusConfirm.id ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Updating…
                  </>
                ) : statusConfirm.isActive ? (
                  "Deactivate"
                ) : (
                  "Activate"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <form
            onSubmit={onSave}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl"
          >
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>First name</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  Password {editingId ? "(leave blank to keep)" : ""}
                </Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required={!editingId}
                  minLength={editingId && !form.password ? undefined : 8}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <label
                      key={role}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      {roleLabels[role]}
                    </label>
                  ))}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
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
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-asphalt-mid text-white hover:bg-asphalt"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
