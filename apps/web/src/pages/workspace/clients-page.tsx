import { useCallback, useEffect, useRef, useState } from "react";
import { TablePagination } from "@/components/table-pagination";
import { toast } from "sonner";
import { Download, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  clientMasterSchema,
  updateClientMasterSchema,
} from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { firstZodIssueMessage } from "@/lib/zod-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_PAGE_SIZE, type SortDirection } from "@/lib/admin-table";
import { AdminTableSearch } from "@/components/admin-table-search";
import { SortableTh } from "@/components/sortable-table-head";
import { showFullPageLoader } from "@/lib/page-load";
import {
  downloadClientSampleCsv,
  downloadClientSampleExcel,
  parseClientSpreadsheet,
} from "@/lib/client-spreadsheet";
import { ModalOverlay } from "@/components/modal-overlay";
import { ConfirmDialog } from "@/components/confirm-dialog";

type ClientRow = {
  id: string;
  foundationNumber: number | null;
  name: string;
  isActive: boolean;
};

export function ClientsPage() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("foundationNumber");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [form, setForm] = useState({
    foundationNumber: "",
    name: "",
    isActive: true,
  });

  const hasLoadedRef = useRef(false);

  const load = useCallback(
    async (background = false) => {
      if (!background) setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(ADMIN_PAGE_SIZE),
        });
        if (search.trim()) params.set("q", search.trim());
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);
        const data = await apiFetch<{
          clients: ClientRow[];
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        }>(`/api/v1/clients?${params}`);
        setRows(data.clients);
        setTotal(data.total);
        if (data.page !== page) setPage(data.page);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load clients",
        );
      } finally {
        setLoading(false);
      }
    },
    [page, search, sortBy, sortDir],
  );

  function toggleSort(key: string) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setPage(1);
        setSearch(next);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput, search]);

  useEffect(() => {
    void load(hasLoadedRef.current);
    hasLoadedRef.current = true;
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm({ foundationNumber: "", name: "", isActive: true });
    setOpen(true);
  }

  function openEdit(row: ClientRow) {
    setEditingId(row.id);
    setForm({
      foundationNumber:
        row.foundationNumber != null ? String(row.foundationNumber) : "",
      name: row.name,
      isActive: row.isActive,
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const foundationNumber = form.foundationNumber.trim()
        ? Number(form.foundationNumber.trim())
        : null;
      const raw = {
        name: form.name.trim(),
        foundationNumber,
        isActive: form.isActive,
      };
      const schema = editingId ? updateClientMasterSchema : clientMasterSchema;
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        toast.error(firstZodIssueMessage(parsed.error));
        return;
      }
      if (editingId) {
        await apiFetch(`/api/v1/clients/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
        toast.success("Client updated");
      } else {
        await apiFetch("/api/v1/clients", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        toast.success("Client created");
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
      await apiFetch(`/api/v1/clients/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function onImport() {
    if (!importFile || importing) return;
    setImporting(true);
    try {
      const rows = await parseClientSpreadsheet(importFile);
      if (rows.length === 0) {
        toast.error(
          "No valid rows found. Use columns Foundation # and Name, or download the sample file.",
        );
        return;
      }
      const result = await apiFetch<{
        upserted: number;
        errorCount: number;
        errors: { row: number; message: string }[];
      }>("/api/v1/clients/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      toast.success(
        `Imported ${result.upserted} client(s)${result.errorCount ? `, ${result.errorCount} error(s)` : ""}`,
      );
      if (result.upserted === 0 && result.errors.length > 0) {
        toast.error(
          result.errors
            .slice(0, 3)
            .map((e) => `Row ${e.row}: ${e.message}`)
            .join(" · "),
        );
      }
      setImportOpen(false);
      setImportFile(null);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
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
            Clients
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Foundation customer list — used as suggestions when creating projects.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import CSV/Excel
          </Button>
          <Button
            className="bg-asphalt-mid text-white hover:bg-asphalt"
            onClick={openCreate}
          >
            <Plus className="size-4" /> Add client
          </Button>
        </div>
      </div>

      <AdminTableSearch
        className="mb-4"
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Search clients…"
      />

      {showFullPageLoader(loading, rows.length > 0) ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <SortableTh label="Foundation #" sortKey="foundationNumber" activeSortKey={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Name" sortKey="name" activeSortKey={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Status" sortKey="status" activeSortKey={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-2 py-4 text-center text-sm text-muted-foreground"
                  >
                    {total === 0 && !search
                      ? "No clients yet. Import your customer list or add one manually."
                      : "No clients match your search."}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">
                    {r.foundationNumber ?? "—"}
                  </td>
                  <td className="px-2 py-1 font-medium">{r.name}</td>
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
                        title="Delete client"
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
          <TablePagination
            page={page}
            pageSize={ADMIN_PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}

      <ModalOverlay open={open} onBackdropClick={() => setOpen(false)}>
        <form
          onSubmit={onSave}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl"
        >
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit client" : "New client"}
            </h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Foundation #</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.foundationNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, foundationNumber: e.target.value }))
                  }
                  placeholder="Optional"
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
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
            className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Import clients (CSV/Excel)</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Columns: <strong>Foundation #</strong> and <strong>Name</strong>.
              Existing names are updated; new names are added.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadClientSampleCsv()}
              >
                <Download className="size-4" /> Sample CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadClientSampleExcel()}
              >
                <Download className="size-4" /> Sample Excel
              </Button>
            </div>
            <div className="mt-4">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportOpen(false);
                  setImportFile(null);
                }}
              >
                Cancel
              </Button>
              <Button disabled={!importFile || importing} onClick={() => void onImport()}>
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete client?"
        description={
          <>
            Remove <strong>{deleteTarget?.name}</strong>? This cannot be undone if
            the client is not used on any project.
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
