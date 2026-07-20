import { useEffect, useMemo, useState, Fragment } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Upload,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ModalCloseButton,
  UnsavedCloseDialog,
} from "@/components/unsaved-close-dialog";

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
  isActive: true,
};

export function TasksPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [types, setTypes] = useState<ProjectTypeOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"master" | "sub">("master");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState(emptyForm);
  const [formBaseline, setFormBaseline] = useState("");
  const [unsavedPrompt, setUnsavedPrompt] = useState(false);

  function snapshotForm(next: typeof emptyForm) {
    return JSON.stringify(next);
  }

  const isDirty =
    open && formBaseline !== "" && snapshotForm(form) !== formBaseline;

  async function load() {
    setLoading(true);
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

  useEffect(() => {
    void load();
  }, []);

  const masters = useMemo(
    () => bids.filter((b) => !b.parentId),
    [bids],
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
    if (!form.division) {
      toast.error("Division is required", { id: "bid-master" });
      return;
    }
    if (mode === "sub" && !form.parentId) {
      toast.error("Select a master bid for this sub-bid", { id: "bid-master" });
      return;
    }
    if (!form.unit.trim()) {
      toast.error("Select a unit", { id: "bid-master" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        unit: form.unit,
        formType: form.formType,
        projectTypeId: form.projectTypeId || null,
        parentId: mode === "sub" ? form.parentId || null : null,
        division: form.division,
        description: form.description || null,
        isActive: form.isActive,
      };
      if (editingId) {
        await apiFetch(`/api/v1/tasks/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success(mode === "sub" ? "Sub-bid updated" : "Master bid updated", {
          id: "bid-master",
        });
      } else {
        await apiFetch("/api/v1/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(mode === "sub" ? "Sub-bid created" : "Master bid created", {
          id: "bid-master",
        });
      }
      closeForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed", {
        id: "bid-master",
      });
    } finally {
      setSaving(false);
    }
  }

  function parseCsv(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });
      return {
        code: row.code,
        name: row.name,
        unit: row.unit || "LF",
        formType: (row.formtype || row.form_type || "STA_RANGE").toUpperCase(),
        projectTypeCode: row.projecttypecode || row.project_type_code || null,
        parentCode: row.parentcode || row.parent_code || null,
        division: row.division || null,
        description: row.description || null,
      };
    });
  }

  async function onImport() {
    setSaving(true);
    try {
      const rows = parseCsv(csvText);
      if (!rows.length) {
        toast.error("CSV needs a header and at least one data row", {
          id: "bid-master",
        });
        return;
      }
      const result = await apiFetch<{
        upserted: number;
        errorCount: number;
      }>("/api/v1/tasks/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      toast.success(
        `Imported ${result.upserted} bid(s)${result.errorCount ? `, ${result.errorCount} error(s)` : ""}`,
        { id: "bid-master" },
      );
      setImportOpen(false);
      setCsvText("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed", {
        id: "bid-master",
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
            Masters
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Bid master
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Line codes XXC## (type + color + width). CF for Reported LF = (End
            STA − Begin STA) × 100 × CF. Widths 4″ / 6″ / 10″ / 24″.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import CSV
          </Button>
          <Button
            className="bg-asphalt-mid text-white hover:bg-asphalt"
            onClick={openCreateMaster}
          >
            <Plus className="size-4" /> Add master bid
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Line code</th>
                  <th className="px-4 py-3">Bid / Sub-bid</th>
                  <th className="px-4 py-3">Color</th>
                  <th className="px-4 py-3">Width</th>
                  <th className="px-4 py-3">CF</th>
                  <th className="px-4 py-3">Division</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {masters.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No bids yet. Add a master bid, then add sub-bids under it.
                    </td>
                  </tr>
                )}
                {masters.map((master) => {
                  const kids =
                    childrenByParent.get(master.id) ??
                    (master.children as Bid[] | undefined) ??
                    [];
                  const openRow = expanded[master.id] ?? true;
                  return (
                    <Fragment key={master.id}>
                      <tr className="border-b bg-muted/20 font-medium last:border-0">
                        <td className="px-4 py-2.5">
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
                              {openRow ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </button>
                            <span className="font-mono text-xs">{master.code}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="mr-2 rounded bg-asphalt px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase">
                            Master
                          </span>
                          {master.name}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {kids.length} sub-bid{kids.length === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs">—</td>
                        <td className="px-4 py-2.5 text-xs">—</td>
                        <td className="px-4 py-2.5 text-xs">—</td>
                        <td className="px-4 py-2.5 text-xs">
                          {master.division
                            ? divisionLabels[master.division] ?? master.division
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {master.isActive ? "Active" : "Inactive"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
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
                            onClick={() => openEdit(master)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </td>
                      </tr>
                      {openRow &&
                        kids.map((sub) => (
                          <tr
                            key={sub.id}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-4 py-2 pl-10 font-mono text-xs font-semibold text-asphalt-mid">
                              {sub.code}
                            </td>
                            <td className="px-4 py-2 pl-6">
                              <span className="mr-2 rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                                Sub
                              </span>
                              {sub.name}
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {sub.color ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {sub.widthInches != null
                                ? `${sub.widthInches}"`
                                : "—"}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs font-semibold">
                              {sub.conversionFactor != null
                                ? Number(sub.conversionFactor).toFixed(2)
                                : "—"}
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {sub.division
                                ? divisionLabels[sub.division] ?? sub.division
                                : "—"}
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {sub.isActive ? "Active" : "Inactive"}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(sub)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
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
                    ? "Sub-bid inherits context from its master — set division clearly."
                    : "Create a master bid, then add sub-bids under it."}
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
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  required
                />
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Generic name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
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
            <h2 className="text-lg font-semibold">Import bids (CSV)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Headers: code,name,unit,formType,projectTypeCode,parentCode,division,description
            </p>
            <textarea
              className={cn(
                "mt-3 min-h-40 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`code,name,unit,formType,projectTypeCode,parentCode,division,description\nPM-LONG,Longitudinal Striping,LOT,STA_RANGE,PM,,PAVEMENT_MARKING,\nPM-4W-EDGE,4" Edge Line,LF,STA_RANGE,PM,PM-LONG,PAVEMENT_MARKING,`}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-asphalt-mid text-white hover:bg-asphalt"
                disabled={saving}
                onClick={() => void onImport()}
              >
                {saving ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
