import { useEffect, useMemo, useState, Fragment } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { taskMasterSchema, updateTaskMasterSchema } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { firstZodIssueMessage } from "@/lib/zod-error";
import { Button } from "@/components/ui/button";
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
import {
  downloadBidSampleCsv,
  downloadBidSampleExcel,
  parseBidSpreadsheet,
} from "@/lib/bid-spreadsheet";

type ProjectTypeOpt = { id: string; code: string; name: string };
type UnitOpt = { id: string; code: string; name: string; isActive?: boolean };
type Bid = {
  id: string;
  code: string;
  name: string;
  unit: string;
  formType: string;
  division: string | null;
  description: string | null;
  isActive: boolean;
  parentId: string | null;
  color: string | null;
  widthInches: number | null;
  conversionFactor: number | null;
  parent?: { id: string; code: string; name: string } | null;
  children?: {
    id: string;
    code: string;
    name: string;
    unit: string;
    division: string | null;
    color?: string | null;
    widthInches?: number | null;
    conversionFactor?: number | null;
  }[];
  projectType: ProjectTypeOpt | null;
  _count?: { children: number };
};

const divisionLabels: Record<string, string> = {
  PAVEMENT_MARKING: "Pavement Marking",
  TRAFFIC_CONTROL: "Traffic Control",
  PERMANENT_SIGNS: "Permanent Signs",
  MISCELLANEOUS: "Miscellaneous",
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const emptyForm = {
  code: "",
  name: "",
  unit: "LF",
  formType: "STA_RANGE",
  projectTypeId: "",
  parentId: "",
  division: "PAVEMENT_MARKING",
  description: "",
  color: "",
  widthInches: "",
  conversionFactor: "",
  isActive: true,
};

function slugCodeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function TasksPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [types, setTypes] = useState<ProjectTypeOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"master" | "sub">("master");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState(emptyForm);
  const [formBaseline, setFormBaseline] = useState("");
  const [unsavedPrompt, setUnsavedPrompt] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Bid | null>(null);
  const [deleting, setDeleting] = useState(false);

  function snapshotForm(next: typeof emptyForm) {
    return JSON.stringify(next);
  }

  const isDirty =
    open && formBaseline !== "" && snapshotForm(form) !== formBaseline;

  async function load(background = false) {
    if (!background) setLoading(true);
    try {
      const [t, pt, u] = await Promise.all([
        apiFetch<{ tasks: Bid[] }>("/api/v1/tasks"),
        apiFetch<{ projectTypes: ProjectTypeOpt[] }>(
          "/api/v1/project-types?active=true",
        ),
        apiFetch<{ units: UnitOpt[] }>("/api/v1/units?active=true"),
      ]);
      setBids(t.tasks);
      setTypes(pt.projectTypes);
      setUnits(u.units);
      const exp: Record<string, boolean> = {};
      t.tasks.filter((b) => !b.parentId).forEach((b) => {
        exp[b.id] = true;
      });
      setExpanded((prev) => ({ ...exp, ...prev }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load bids", {
        id: "bid-master",
      });
    } finally {
      setLoading(false);
    }
  }

  const defaultUnitCode = useMemo(() => {
    const lf = units.find((u) => u.code.toUpperCase() === "LF");
    return lf?.code ?? units[0]?.code ?? "LF";
  }, [units]);

  const unitOptions = useMemo(() => {
    const opts = [...units];
    if (
      form.unit &&
      !opts.some((u) => u.code.toUpperCase() === form.unit.toUpperCase())
    ) {
      opts.push({ id: `legacy-${form.unit}`, code: form.unit, name: form.unit });
    }
    return opts;
  }, [units, form.unit]);

  const filteredMasters = useMemo(() => {
    const list = bids
      .filter((b) => !b.parentId)
      .sort((a, b) => a.code.localeCompare(b.code));
    const q = search.trim().toLowerCase();
    return list.filter((master) => {
      if (divisionFilter !== "ALL" && master.division !== divisionFilter) {
        const kids = bids.filter((b) => b.parentId === master.id);
        if (!kids.some((k) => k.division === divisionFilter)) return false;
      }
      if (!q) return true;
      const kids = bids.filter((b) => b.parentId === master.id);
      return (
        master.code.toLowerCase().includes(q) ||
        master.name.toLowerCase().includes(q) ||
        kids.some(
          (k) =>
            k.code.toLowerCase().includes(q) ||
            k.name.toLowerCase().includes(q),
        )
      );
    });
  }, [bids, search, divisionFilter]);

  const paginatedMasters = useMemo(
    () => paginateSlice(filteredMasters, page, ADMIN_PAGE_SIZE),
    [filteredMasters, page],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Bid[]>();
    for (const b of bids) {
      if (!b.parentId) continue;
      const list = map.get(b.parentId) ?? [];
      list.push(b);
      map.set(b.parentId, list);
    }
    return map;
  }, [bids]);

  const masters = useMemo(() => bids.filter((b) => !b.parentId), [bids]);

  const selectedMaster = useMemo(
    () => masters.find((m) => m.id === form.parentId) ?? null,
    [masters, form.parentId],
  );

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, divisionFilter]);

  const title = useMemo(() => {
    if (editingId) return mode === "sub" ? "Edit sub-bid" : "Edit master bid";
    return mode === "sub" ? "New sub-bid" : "New master bid";
  }, [editingId, mode]);

  function openCreateMaster() {
    setEditingId(null);
    setMode("master");
    const next = { ...emptyForm, parentId: "", unit: defaultUnitCode };
    setForm(next);
    setFormBaseline(snapshotForm(next));
    setUnsavedPrompt(false);
    setOpen(true);
  }

  function openCreateSub(parent: Bid) {
    setEditingId(null);
    setMode("sub");
    const next = {
      ...emptyForm,
      parentId: parent.id,
      division: parent.division ?? "PAVEMENT_MARKING",
      projectTypeId: parent.projectType?.id ?? "",
      unit: parent.unit || defaultUnitCode,
      formType: parent.formType || "STA_RANGE",
      conversionFactor: "1.00",
    };
    setForm(next);
    setFormBaseline(snapshotForm(next));
    setUnsavedPrompt(false);
    setOpen(true);
  }

  function openEdit(bid: Bid) {
    setEditingId(bid.id);
    setMode(bid.parentId ? "sub" : "master");
    const next = {
      code: bid.code,
      name: bid.name,
      unit: bid.unit,
      formType: bid.formType,
      projectTypeId: bid.projectType?.id ?? "",
      parentId: bid.parentId ?? "",
      division: bid.division ?? "PAVEMENT_MARKING",
      description: bid.description ?? "",
      color: bid.color ?? "",
      widthInches: bid.widthInches != null ? String(bid.widthInches) : "",
      conversionFactor:
        bid.conversionFactor != null ? String(bid.conversionFactor) : "",
      isActive: bid.isActive,
    };
    setForm(next);
    setFormBaseline(snapshotForm(next));
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

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const code = editingId
      ? form.code.trim()
      : slugCodeFromName(form.name);
    setSaving(true);
    try {
      const raw = {
        code,
        name: form.name.trim(),
        unit: form.unit.trim(),
        formType: form.formType,
        projectTypeId: form.projectTypeId || null,
        parentId: mode === "sub" ? form.parentId || null : null,
        division: form.division || null,
        description: form.description.trim() || null,
        color: mode === "sub" && form.color.trim() ? form.color.trim() : null,
        widthInches:
          mode === "sub" && form.widthInches.trim()
            ? Number(form.widthInches)
            : null,
        conversionFactor:
          mode === "sub" && form.conversionFactor.trim()
            ? Number(form.conversionFactor)
            : null,
        isActive: form.isActive,
      };
      if (mode === "sub" && !raw.parentId) {
        toast.error("Select a master bid for this sub-bid", { id: "bid-master" });
        return;
      }
      const schema = editingId ? updateTaskMasterSchema : taskMasterSchema;
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        toast.error(firstZodIssueMessage(parsed.error), { id: "bid-master" });
        return;
      }
      if (editingId) {
        await apiFetch(`/api/v1/tasks/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
        toast.success(mode === "sub" ? "Sub-bid updated" : "Master bid updated", {
          id: "bid-master",
        });
      } else {
        await apiFetch("/api/v1/tasks", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        toast.success(mode === "sub" ? "Sub-bid created" : "Master bid created", {
          id: "bid-master",
        });
      }
      closeForm();
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed", {
        id: "bid-master",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onImport() {
    if (!importFile || importing) return;
    setImporting(true);
    try {
      const rows = await parseBidSpreadsheet(importFile);
      if (rows.length === 0) {
        toast.error(
          "No valid rows found. Use Item Reference #, Description, Unit, Division — or download the sample file.",
          { id: "bid-master" },
        );
        return;
      }
      const result = await apiFetch<{
        added: number;
        skipped: number;
        errorCount: number;
        errors: { row: number; message: string }[];
      }>("/api/v1/tasks/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      const parts = [`Added ${result.added} new bid item(s)`];
      if (result.skipped > 0) {
        parts.push(`${result.skipped} already existed (skipped)`);
      }
      if (result.errorCount > 0) {
        parts.push(`${result.errorCount} error(s)`);
      }
      toast.success(parts.join(", "), { id: "bid-master" });
      if (result.added === 0 && result.errors.length > 0) {
        toast.error(
          result.errors
            .slice(0, 3)
            .map((e) => `Row ${e.row}: ${e.message}`)
            .join(" · "),
          { id: "bid-master", duration: 8000 },
        );
      }
      setImportOpen(false);
      setImportFile(null);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed", {
        id: "bid-master",
      });
    } finally {
      setImporting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/tasks/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`Deleted ${deleteTarget.code}`, { id: "bid-master" });
      setDeleteTarget(null);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed", {
        id: "bid-master",
      });
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
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Bid master
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Excel import adds new master bids. Existing items and sub-bids are kept.
            Add sub-bids under each master for line
            codes, color, width, and conversion factor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import Excel
          </Button>
          <Button
            className="bg-asphalt-mid text-white hover:bg-asphalt"
            onClick={openCreateMaster}
          >
            <Plus className="size-4" /> Add master bid
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bid items…"
        />
        <select
          className={cn(selectClass, "max-w-xs")}
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
      </div>

      {showFullPageLoader(loading, bids.length > 0) ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">Ref #</th>
                  <th className="px-2 py-1">Generic name</th>
                  <th className="px-2 py-1">Sub-bid</th>
                  <th className="px-2 py-1">Unit</th>
                  <th className="px-2 py-1">Color</th>
                  <th className="px-2 py-1">Width</th>
                  <th className="px-2 py-1">CF</th>
                  <th className="px-2 py-1">Division</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {filteredMasters.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-2 py-4 text-center text-sm text-muted-foreground"
                    >
                      {bids.length === 0
                        ? "No bid items yet. Import Bid Item List.xlsx or add manually."
                        : "No bid items match your search."}
                    </td>
                  </tr>
                )}
                {paginatedMasters.items.map((master) => {
                  const kids =
                    childrenByParent.get(master.id) ??
                    (master.children as Bid[] | undefined) ??
                    [];
                  const openRow = expanded[master.id] ?? true;
                  return (
                    <Fragment key={master.id}>
                      <tr className="border-b border-border/80 bg-muted/20 font-medium">
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="text-muted-foreground"
                              onClick={() =>
                                setExpanded((e) => ({
                                  ...e,
                                  [master.id]: !openRow,
                                }))
                              }
                            >
                              {kids.length > 0 ? (
                                openRow ? (
                                  <ChevronDown className="size-4" />
                                ) : (
                                  <ChevronRight className="size-4" />
                                )
                              ) : (
                                <span className="inline-block size-4" />
                              )}
                            </button>
                            <span className="font-mono text-xs">{master.code}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">{master.name}</td>
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">
                          <span className="mr-1 rounded bg-asphalt px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase">
                            Master
                          </span>
                          {kids.length} sub-bid{kids.length === 1 ? "" : "s"}
                        </td>
                        <td className="px-2 py-1.5 text-xs">{master.unit}</td>
                        <td className="px-2 py-1.5 text-xs">—</td>
                        <td className="px-2 py-1.5 text-xs">—</td>
                        <td className="px-2 py-1.5 text-xs">—</td>
                        <td className="px-2 py-1.5 text-xs text-foreground/80">
                          {master.division
                            ? divisionLabels[master.division] ?? master.division
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {master.isActive ? "Active" : "Inactive"}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openCreateSub(master)}
                            >
                              <Plus className="size-3.5" /> Sub-bid
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit master bid"
                              onClick={() => openEdit(master)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete master bid"
                              aria-label="Delete master bid"
                              onClick={() => setDeleteTarget(master)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {openRow &&
                        kids.map((sub) => (
                          <tr
                            key={sub.id}
                            className="border-b border-border/80 last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-2 py-1.5 pl-8 font-mono text-xs font-semibold text-asphalt-mid">
                              {sub.code}
                            </td>
                            <td className="px-2 py-1.5 pl-4 text-muted-foreground">
                              {master.name}
                            </td>
                            <td className="px-2 py-1.5 pl-4">{sub.name}</td>
                            <td className="px-2 py-1.5 text-xs">{sub.unit}</td>
                            <td className="px-2 py-1.5 text-xs">
                              {sub.color ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 text-xs">
                              {sub.widthInches != null
                                ? `${sub.widthInches}"`
                                : "—"}
                            </td>
                            <td className="px-2 py-1.5 font-mono text-xs font-semibold">
                              {sub.conversionFactor != null
                                ? Number(sub.conversionFactor).toFixed(2)
                                : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-xs text-foreground/80">
                              {sub.division
                                ? divisionLabels[sub.division] ?? sub.division
                                : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-xs">
                              {sub.isActive ? "Active" : "Inactive"}
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Edit sub-bid"
                                  onClick={() => openEdit(sub)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Delete sub-bid"
                                  aria-label="Delete sub-bid"
                                  onClick={() => setDeleteTarget(sub)}
                                >
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredMasters.length > 0 && (
            <TablePagination
              page={paginatedMasters.page}
              pageSize={ADMIN_PAGE_SIZE}
              total={paginatedMasters.total}
              onPageChange={setPage}
            />
          )}
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
            "bid-form-modal",
          ) as HTMLFormElement | null;
          formEl?.requestSubmit();
        }}
      />

      {open && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black/45 p-4">
          <form
            id="bid-form-modal"
            onSubmit={onSave}
            className="relative z-[2001] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "sub"
                    ? "Sub-bid under a master — set line code details (color, width, CF)."
                    : "Master bid generic name from the bid item list."}
                </p>
              </div>
              <ModalCloseButton onClick={requestCloseForm} disabled={saving} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {mode === "sub" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Master bid</Label>
                  <select
                    className={selectClass}
                    value={form.parentId}
                    onChange={(e) => {
                      const parent = masters.find((m) => m.id === e.target.value);
                      setForm((f) => ({
                        ...f,
                        parentId: e.target.value,
                        division:
                          parent?.division ?? f.division ?? "PAVEMENT_MARKING",
                        projectTypeId: parent?.projectType?.id ?? f.projectTypeId,
                        unit: parent?.unit || f.unit || defaultUnitCode,
                      }));
                    }}
                    required
                  >
                    <option value="">— Select master —</option>
                    {masters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} — {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Division *</Label>
                <select
                  className={selectClass}
                  value={form.division}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, division: e.target.value }))
                  }
                  required
                >
                  {Object.entries(divisionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Unit *</Label>
                <select
                  className={selectClass}
                  value={form.unit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unit: e.target.value }))
                  }
                  required
                >
                  <option value="">— Select unit —</option>
                  {unitOptions.map((u) => (
                    <option key={u.id} value={u.code}>
                      {u.code} — {u.name}
                    </option>
                  ))}
                </select>
                {units.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No active units. Add units under Masters → Units first.
                  </p>
                )}
              </div>
              {mode === "sub" && selectedMaster && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Generic name (from master)</Label>
                  <Input
                    readOnly
                    className="bg-muted text-muted-foreground"
                    value={selectedMaster.name}
                  />
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  {mode === "sub" ? "Sub-bid name *" : "Generic name *"}
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
                {!editingId && (
                  <p className="text-xs text-muted-foreground">
                    Line code is generated automatically from the name.
                  </p>
                )}
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
                <Label>Form type</Label>
                <select
                  className={selectClass}
                  value={form.formType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, formType: e.target.value }))
                  }
                >
                  <option value="STA_RANGE">STA Range</option>
                  <option value="SINGLE_LOCATION">Single Location</option>
                </select>
              </div>
              {mode === "sub" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Color</Label>
                    <Input
                      value={form.color}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color: e.target.value }))
                      }
                      placeholder="White, Yellow, …"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Width (inches)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.widthInches}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, widthInches: e.target.value }))
                      }
                      placeholder="4, 6, 10, 24"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conversion factor (CF)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.conversionFactor}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          conversionFactor: e.target.value,
                        }))
                      }
                      placeholder="1.00"
                    />
                  </div>
                </>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
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
                    : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {importOpen && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black/45 p-4">
          <div className="relative z-[2001] w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Import bid master (Excel)</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload <strong>Bid Item List.xlsx</strong> with columns: Item Reference #,
              Description, Unit, Division. Only <strong>new</strong> items are added;
              existing bids with the same code are skipped.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadBidSampleCsv()}
              >
                <Download className="size-4" /> Sample CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadBidSampleExcel()}
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
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportOpen(false);
                  setImportFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-asphalt-mid text-white hover:bg-asphalt"
                disabled={!importFile || importing}
                onClick={() => void onImport()}
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

      {deleteTarget && (
        <div className="modal-overlay fixed inset-0 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="relative z-[2001] w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              Delete {deleteTarget.parentId ? "sub-bid" : "master bid"}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget.code} — {deleteTarget.name}
              </span>
              ?
              {!deleteTarget.parentId &&
                (childrenByParent.get(deleteTarget.id)?.length ?? 0) > 0 && (
                  <>
                    {" "}
                    All sub-bids under this master will also be removed if they
                    are not assigned to a project.
                  </>
                )}{" "}
              Bids assigned to projects cannot be deleted.
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
