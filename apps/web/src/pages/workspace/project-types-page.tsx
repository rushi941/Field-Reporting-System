import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { projectTypeSchema, updateProjectTypeSchema } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { firstZodIssueMessage } from "@/lib/zod-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showFullPageLoader } from "@/lib/page-load";
import { TablePagination } from "@/components/table-pagination";
import { AdminTableSearch } from "@/components/admin-table-search";
import { SortableTh } from "@/components/sortable-table-head";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-table";
import { useAdminTable } from "@/hooks/use-admin-table";
import { ModalOverlay } from "@/components/modal-overlay";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  const [deleteTarget, setDeleteTarget] = useState<ProjectType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    division: "",
    isActive: true,
  });

  const typeSortAccessors = useMemo(
    () => ({
      code: (r: ProjectType) => r.code,
      name: (r: ProjectType) => r.name,
      division: (r: ProjectType) => r.division ?? "",
      usage: (r: ProjectType) => r.projectCount,
      status: (r: ProjectType) => (r.isActive ? 1 : 0),
    }),
    [],
  );

  const {
    searchInput,
    setSearchInput,
    sortKey,
    sortDir,
    toggleSort,
    paginated: paginatedRows,
    setPage: setTablePage,
  } = useAdminTable({
    rows,
    getSearchText: (r) =>
      `${r.code} ${r.name} ${r.description ?? ""} ${r.division ?? ""}`,
    sortAccessors: typeSortAccessors,
    defaultSort: { key: "code", direction: "asc" },
  });

  async function load(background = false) {
    if (!background) setLoading(true);
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
      const raw = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        division: form.division || null,
        isActive: form.isActive,
      };
      const schema = editingId ? updateProjectTypeSchema : projectTypeSchema;
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        toast.error(firstZodIssueMessage(parsed.error));
        return;
      }
      if (editingId) {
        await apiFetch(`/api/v1/project-types/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
        toast.success("Project type updated");
      } else {
        await apiFetch("/api/v1/project-types", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        toast.success("Project type created");
      }
      setOpen(false);
      await load(true);
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
      await apiFetch(`/api/v1/project-types/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success(`Deleted project type ${deleteTarget.code}`);
      setDeleteTarget(null);
      await load(true);
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
            Project types
          </h1>
        </div>
        <Button className="bg-asphalt-mid text-white hover:bg-asphalt" onClick={openCreate}>
          <Plus className="size-4" /> Add type
        </Button>
      </div>

      {showFullPageLoader(loading, rows.length > 0) ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <AdminTableSearch
            className="mb-4"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search project types…"
          />
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <SortableTh label="Code" sortKey="code" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Name" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Division" sortKey="division" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Usage" sortKey="usage" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Status" sortKey="status" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {paginatedRows.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {rows.length === 0
                      ? "No project types yet."
                      : "No project types match your search."}
                  </td>
                </tr>
              )}
              {paginatedRows.items.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-2 py-1 font-medium">{r.code}</td>
                  <td className="px-2 py-1">
                    <div>{r.name}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-xs">{r.division ?? "—"}</td>
                  <td className="px-2 py-1 text-xs">
                    {r.projectCount} projects · {r.taskCount} bids
                  </td>
                  <td className="px-2 py-1 text-xs">
                    {r.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <div className="flex justify-end gap-0">
                      <Button variant="ghost" size="iconSm" onClick={() => openEdit(r)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        title="Delete project type"
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
          {rows.length > 0 && (
            <TablePagination
              page={paginatedRows.page}
              pageSize={ADMIN_PAGE_SIZE}
              total={paginatedRows.total}
              onPageChange={setTablePage}
            />
          )}
        </div>
        </>
      )}

      <ModalOverlay open={open} onBackdropClick={() => setOpen(false)}>
        <form
          onSubmit={onSave}
          onClick={(e) => e.stopPropagation()}
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
      </ModalOverlay>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete project type?"
        description={
          <>
            Delete{" "}
            <span className="font-medium text-foreground">
              {deleteTarget?.code} — {deleteTarget?.name}
            </span>
            ? Types linked to projects or bids cannot be deleted.
          </>
        }
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
