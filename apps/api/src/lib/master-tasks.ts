import { prisma } from "@frs/db";
import {
  defaultSymbolTypes,
  estimateTaskQuantity,
  isStaWithCf,
  isSymbolsAndLegendsMaster,
  usesSymbolEntryLayout,
  catalogPavementLineTypes,
} from "@frs/shared";

export type LineTypeOption = {
  id: string;
  code: string;
  name: string;
  label: string;
  conversionFactor: number;
  widthInches: number | null;
  color: string | null;
};

export type SymbolTypeOption = {
  code: string;
  name: string;
  label: string;
};

export function formatLineTypeLabel(
  name: string,
  widthInches: number | null,
): string {
  if (widthInches != null) return `${widthInches}" ${name}`;
  return name;
}

type TaskMasterRef = {
  id: string;
  parentId?: string | null;
  parent?: { id: string; code: string; name: string } | null;
};

export function resolveMasterId(tm: TaskMasterRef): string {
  return tm.parentId ?? tm.parent?.id ?? tm.id;
}

/** PM / STA_WITH_CF masters get a line-type picker at field entry. */
export function usesLineTypePicker(
  division: string,
  formType: string,
  _lineTypeCount = 0,
): boolean {
  return division === "PAVEMENT_MARKING" && isStaWithCf(formType);
}

export async function fetchLineTypesByMasterIds(
  masterIds: string[],
): Promise<Map<string, LineTypeOption[]>> {
  const map = new Map<string, LineTypeOption[]>();
  if (masterIds.length === 0) return map;

  const children = await prisma.taskMaster.findMany({
    where: { parentId: { in: masterIds }, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  for (const c of children) {
    if (!c.parentId) continue;
    const list = map.get(c.parentId) ?? [];
    list.push({
      id: c.id,
      code: c.code,
      name: c.name,
      label: formatLineTypeLabel(c.name, c.widthInches),
      conversionFactor: Number(c.conversionFactor ?? 1),
      widthInches: c.widthInches,
      color: c.color,
    });
    map.set(c.parentId, list);
  }

  if (masterIds.length === 0) return map;

  const masters = await prisma.taskMaster.findMany({
    where: { id: { in: masterIds } },
    select: { id: true, division: true, formType: true },
  });

  const catalog = catalogPavementLineTypes();
  for (const master of masters) {
    const existing = map.get(master.id) ?? [];
    if (existing.length > 0) continue;
    if (usesLineTypePicker(master.division ?? "", master.formType, 0)) {
      map.set(master.id, catalog);
    }
  }

  return map;
}

export async function fetchSymbolTypesByMasterIds(
  masterIds: string[],
  masterMeta: Map<string, { code: string; name: string; division: string; unit: string; formType: string }>,
): Promise<Map<string, SymbolTypeOption[]>> {
  const map = new Map<string, SymbolTypeOption[]>();
  if (masterIds.length === 0) return map;

  const children = await prisma.taskMaster.findMany({
    where: { parentId: { in: masterIds }, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  for (const c of children) {
    if (!c.parentId) continue;
    const meta = masterMeta.get(c.parentId);
    if (!meta) continue;
    if (!isSymbolsAndLegendsMaster(meta.code, meta.name)) continue;
    const list = map.get(c.parentId) ?? [];
    list.push({
      code: c.code,
      name: c.name,
      label: `${c.code} — ${c.name}`,
    });
    map.set(c.parentId, list);
  }

  for (const masterId of masterIds) {
    const meta = masterMeta.get(masterId);
    if (!meta) continue;
    const existing = map.get(masterId) ?? [];
    if (existing.length > 0) continue;
    if (
      isSymbolsAndLegendsMaster(meta.code, meta.name) ||
      /^BI-0063$/i.test(meta.code.trim())
    ) {
      map.set(masterId, defaultSymbolTypes());
    }
  }

  return map;
}

type RawFieldTask = {
  id: string;
  division: string;
  assignedToId: string | null;
  assignedTo: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  beginSta: string | null;
  endSta: string | null;
  estimatedQuantity?: number | null;
  taskMaster: {
    id: string;
    code: string;
    name: string;
    unit: string;
    formType: string;
    division: string;
    color: string | null;
    widthInches: number | null;
    conversionFactor: unknown;
    parentId: string | null;
    parent: {
      id: string;
      code: string;
      name: string;
      unit: string;
      formType: string;
      division: string;
    } | null;
  };
};

export type GroupedFieldTask = {
  id: string;
  division: string;
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  isMine: boolean;
  beginSta: string | null;
  endSta: string | null;
  estimatedQuantity?: number | null;
  completedStaRanges: { beginSta: string; endSta: string; reportNumber: string }[];
  progress: {
    estimated: number;
    approved: number;
    pending: number;
    approvedPct: number;
  };
  taskMaster: {
    id: string;
    code: string;
    name: string;
    unit: string;
    formType: string;
    division: string;
    color: string | null;
    widthInches: number | null;
    conversionFactor: number | null;
  };
  lineTypes: LineTypeOption[];
  usesLineTypePicker: boolean;
  symbolTypes: SymbolTypeOption[];
  usesSymbolEntry: boolean;
  relatedProjectTaskIds: string[];
};

export function groupFieldTasksByMaster(
  tasks: RawFieldTask[],
  userId: string,
  completedMap: Map<string, { beginSta: string; endSta: string; reportNumber: string }[]>,
  progressMap: Map<string, { estimated: number; approved: number; pending: number; approvedPct: number }>,
  lineTypesByMaster: Map<string, LineTypeOption[]>,
  symbolTypesByMaster: Map<string, SymbolTypeOption[]>,
  canWorkAllProjectTasks = false,
): GroupedFieldTask[] {
  const groups = new Map<string, GroupedFieldTask & { _projectTaskIds: string[] }>();

  for (const t of tasks) {
    const masterId = resolveMasterId(t.taskMaster);
    const masterRow = t.taskMaster.parent ?? t.taskMaster;
    const isMasterLevel = !t.taskMaster.parentId;

    let group = groups.get(masterId);
    if (!group) {
      const lineTypes = lineTypesByMaster.get(masterId) ?? [];
      const symbolTypes = symbolTypesByMaster.get(masterId) ?? [];
      group = {
        id: t.id,
        division: t.division,
        assignedToId: t.assignedToId,
        assignedTo: t.assignedTo
          ? {
              id: t.assignedTo.id,
              name: `${t.assignedTo.firstName} ${t.assignedTo.lastName}`.trim(),
              email: t.assignedTo.email,
            }
          : null,
        isMine: canWorkAllProjectTasks || t.assignedToId === userId,
        beginSta: t.beginSta,
        endSta: t.endSta,
        estimatedQuantity:
          t.estimatedQuantity != null ? Number(t.estimatedQuantity) : null,
        completedStaRanges: completedMap.get(t.id) ?? [],
        progress: { estimated: 0, approved: 0, pending: 0, approvedPct: 0 },
        taskMaster: {
          id: masterId,
          code: masterRow.code,
          name: masterRow.name,
          unit: masterRow.unit,
          formType: masterRow.formType,
          division: masterRow.division,
          color: t.taskMaster.color,
          widthInches: t.taskMaster.widthInches,
          conversionFactor:
            t.taskMaster.conversionFactor != null
              ? Number(t.taskMaster.conversionFactor)
              : null,
        },
        lineTypes,
        usesLineTypePicker: usesLineTypePicker(
          masterRow.division,
          masterRow.formType,
          lineTypes.length,
        ),
        symbolTypes,
        usesSymbolEntry: usesSymbolEntryLayout({
          formType: masterRow.formType,
          division: masterRow.division,
          unit: masterRow.unit,
          masterCode: masterRow.code,
          masterName: masterRow.name,
          symbolTypeCount: symbolTypes.length,
        }),
        relatedProjectTaskIds: [t.id],
        _projectTaskIds: [t.id],
      };
      groups.set(masterId, group);
    } else {
      group._projectTaskIds.push(t.id);
      group.relatedProjectTaskIds.push(t.id);
      if (isMasterLevel) {
        group.id = t.id;
        group.beginSta = t.beginSta;
        group.endSta = t.endSta;
        group.estimatedQuantity =
          t.estimatedQuantity != null ? Number(t.estimatedQuantity) : null;
        group.assignedToId = t.assignedToId;
        group.assignedTo = t.assignedTo
          ? {
              id: t.assignedTo.id,
              name: `${t.assignedTo.firstName} ${t.assignedTo.lastName}`.trim(),
              email: t.assignedTo.email,
            }
          : null;
        group.isMine = canWorkAllProjectTasks || t.assignedToId === userId;
      }
      group.completedStaRanges.push(...(completedMap.get(t.id) ?? []));
    }

    const p = progressMap.get(t.id);
    if (p) {
      group.progress.approved += p.approved;
      group.progress.pending += p.pending;
      group.progress.estimated = Math.max(group.progress.estimated, p.estimated);
    }
  }

  return [...groups.values()].map((g) => {
    const { _projectTaskIds: _, ...rest } = g;
    const estimated = estimateTaskQuantity({
      unit: rest.taskMaster.unit,
      formType: rest.taskMaster.formType,
      conversionFactor: rest.taskMaster.conversionFactor,
      estimatedQuantity: rest.estimatedQuantity,
      beginSta: rest.beginSta,
      endSta: rest.endSta,
      reportedApproved: rest.progress.approved,
      reportedPending: rest.progress.pending,
    });
    if (estimated > 0) rest.progress.estimated = estimated;
    const reportedPct =
      rest.progress.estimated > 0
        ? Math.min(
            100,
            Math.round(
              ((rest.progress.approved + rest.progress.pending) /
                rest.progress.estimated) *
                100,
            ),
          )
        : rest.progress.approved + rest.progress.pending > 0
          ? 100
          : 0;
    rest.progress.approvedPct = reportedPct;
    return rest;
  });
}
