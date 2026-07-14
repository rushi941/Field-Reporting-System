import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";

export type TaskNode = {
  id: string;
  code: string;
  name: string;
  unit: string;
  formType: string;
  division: string | null;
  parentId: string | null;
  sortOrder: number;
  color?: string | null;
  widthInches?: number | null;
  conversionFactor?: number | null;
  children: Omit<TaskNode, "children">[];
};

const divisionLabels: Record<string, string> = {
  PAVEMENT_MARKING: "Pavement Marking",
  TRAFFIC_CONTROL: "Traffic Control",
  PERMANENT_SIGNS: "Permanent Signs",
};

type Props = {
  taskTree: TaskNode[];
  selectedDivisions: string[];
  selectedIds: string[];
  onDivisionsChange: (divisions: string[]) => void;
  onSelectedChange: (ids: string[]) => void;
};

export function ProjectTaskPicker({
  taskTree,
  selectedDivisions,
  selectedIds,
  onDivisionsChange,
  onSelectedChange,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (selectedDivisions.length === 0) return [];
    return taskTree.filter(
      (t) => t.division && selectedDivisions.includes(t.division),
    );
  }, [taskTree, selectedDivisions]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleDivision(div: string) {
    if (selectedDivisions.includes(div)) {
      const next = selectedDivisions.filter((d) => d !== div);
      onDivisionsChange(next);
      // Drop tasks not in remaining divisions
      const keep = new Set(
        taskTree
          .flatMap((p) => [p, ...p.children])
          .filter((t) => t.division && next.includes(t.division))
          .map((t) => t.id),
      );
      onSelectedChange(selectedIds.filter((id) => keep.has(id)));
    } else {
      onDivisionsChange([...selectedDivisions, div]);
    }
  }

  function toggleId(id: string) {
    if (selectedSet.has(id)) {
      onSelectedChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectedChange([...selectedIds, id]);
    }
  }

  function toggleMaster(master: TaskNode) {
    const childIds = master.children.map((c) => c.id);
    const allOn =
      selectedSet.has(master.id) &&
      childIds.every((id) => selectedSet.has(id));
    if (allOn) {
      const drop = new Set([master.id, ...childIds]);
      onSelectedChange(selectedIds.filter((id) => !drop.has(id)));
    } else {
      const next = new Set(selectedIds);
      next.add(master.id);
      childIds.forEach((id) => next.add(id));
      onSelectedChange([...next]);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Divisions on this project</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Select one or more — tasks from each appear below
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(divisionLabels).map(([value, label]) => {
            const on = selectedDivisions.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleDivision(value)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  on
                    ? "border-asphalt bg-asphalt text-white"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Master tasks & sub-tasks</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          {selectedIds.length} selected — field crews see these on the job
        </p>
        {selectedDivisions.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Choose at least one division first
          </p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {filtered.map((master) => {
              const open = expanded[master.id] ?? true;
              const childIds = master.children.map((c) => c.id);
              const masterOn = selectedSet.has(master.id);
              const allChildren =
                childIds.length > 0 &&
                childIds.every((id) => selectedSet.has(id));
              return (
                <div key={master.id} className="rounded-md">
                  <div className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                    <button
                      type="button"
                      className="text-muted-foreground"
                      onClick={() =>
                        setExpanded((e) => ({ ...e, [master.id]: !open }))
                      }
                    >
                      {open ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={masterOn && (childIds.length === 0 || allChildren)}
                      ref={(el) => {
                        if (!el) return;
                        el.indeterminate =
                          masterOn && !allChildren && childIds.some((id) => selectedSet.has(id));
                      }}
                      onChange={() => toggleMaster(master)}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left text-sm"
                      onClick={() => toggleMaster(master)}
                    >
                      <span className="font-medium">{master.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {master.code}
                        {master.division
                          ? ` · ${divisionLabels[master.division] ?? master.division}`
                          : ""}
                      </span>
                    </button>
                  </div>
                  {open &&
                    master.children.map((sub) => (
                      <label
                        key={sub.id}
                        className="ml-9 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={selectedSet.has(sub.id)}
                          onChange={() => toggleId(sub.id)}
                        />
                        <span>
                          {sub.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {sub.code} · {sub.unit}
                          </span>
                        </span>
                      </label>
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
