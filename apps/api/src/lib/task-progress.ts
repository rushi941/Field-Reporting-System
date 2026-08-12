import {
  estimateTaskQuantity,
  isStaFormType,
  quantityFromUnionStaRanges,
} from "@frs/shared";
import { prisma } from "@frs/db";

const APPROVED = ["APPROVED", "APPROVED_WITH_NOTES"] as const;

export type TaskProgress = {
  estimated: number;
  approved: number;
  pending: number;
  approvedPct: number;
};

type TaskForEstimate = {
  id: string;
  beginSta: string | null;
  endSta: string | null;
  taskMaster: {
    unit: string;
    formType: string;
    conversionFactor: number | null;
  };
};

type RouteBounds = {
  beginSta: string | null;
  endSta: string | null;
} | null;

function pct(approved: number, pending: number, estimated: number) {
  if (estimated <= 0) {
    const reported = approved + pending;
    return reported > 0 ? Math.round((approved / reported) * 100) : 0;
  }
  return Math.min(100, Math.round(((approved + pending) / estimated) * 100));
}

/** Older reports stored foot-feet (×100) for STA-unit bids — convert on read. */
function normalizeStoredQuantity(unit: string, qty: number): number {
  const u = unit.trim().toUpperCase();
  if (u !== "STA") return qty;
  if (qty >= 1000 && qty % 100 === 0) return qty / 100;
  return qty;
}

function capReportedTotals(
  approved: number,
  pending: number,
  estimated: number,
): { approved: number; pending: number } {
  if (estimated <= 0) return { approved, pending };
  const approvedCapped = Math.min(approved, estimated);
  const pendingCapped = Math.min(pending, Math.max(0, estimated - approvedCapped));
  return { approved: approvedCapped, pending: pendingCapped };
}

export async function fetchTaskProgressMap(
  taskIds: string[],
  tasks: TaskForEstimate[],
  routesByProjectId: Map<string, RouteBounds>,
  projectIdForTask: Map<string, string>,
): Promise<Map<string, TaskProgress>> {
  const result = new Map<string, TaskProgress>();
  if (taskIds.length === 0) return result;

  const rows = await prisma.reportLineItem.findMany({
    where: {
      projectTaskId: { in: taskIds },
      report: {
        status: { in: ["SUBMITTED", ...APPROVED] },
      },
    },
    select: {
      projectTaskId: true,
      beginSta: true,
      endSta: true,
      finalQuantity: true,
      report: { select: { status: true } },
    },
  });

  const totals = new Map<
    string,
    {
      approved: number;
      pending: number;
      approvedRanges: { beginSta: string; endSta: string }[];
      pendingRanges: { beginSta: string; endSta: string }[];
    }
  >();
  for (const id of taskIds) {
    totals.set(id, {
      approved: 0,
      pending: 0,
      approvedRanges: [],
      pendingRanges: [],
    });
  }

  for (const row of rows) {
    const bucket = totals.get(row.projectTaskId);
    if (!bucket) continue;
    const task = tasks.find((t) => t.id === row.projectTaskId);
    const qty = normalizeStoredQuantity(
      task?.taskMaster.unit ?? "LF",
      Number(row.finalQuantity),
    );
    const range =
      row.beginSta && row.endSta
        ? { beginSta: row.beginSta, endSta: row.endSta }
        : null;
    if (row.report.status === "SUBMITTED") {
      bucket.pending += qty;
      if (range) bucket.pendingRanges.push(range);
    } else {
      bucket.approved += qty;
      if (range) bucket.approvedRanges.push(range);
    }
  }

  for (const task of tasks) {
    const t = totals.get(task.id) ?? {
      approved: 0,
      pending: 0,
      approvedRanges: [],
      pendingRanges: [],
    };
    const projectId = projectIdForTask.get(task.id);
    const route = projectId ? routesByProjectId.get(projectId) ?? null : null;
    const cf =
      task.taskMaster.conversionFactor != null
        ? Number(task.taskMaster.conversionFactor)
        : 1;
    const estimated = estimateTaskQuantity({
      unit: task.taskMaster.unit,
      formType: task.taskMaster.formType,
      conversionFactor: cf,
      beginSta: task.beginSta,
      endSta: task.endSta,
      routeBeginSta: route?.beginSta,
      routeEndSta: route?.endSta,
      reportedApproved: t.approved,
      reportedPending: t.pending,
    });

    let approved = t.approved;
    let pending = t.pending;

    if (isStaFormType(task.taskMaster.formType)) {
      if (t.approvedRanges.length) {
        approved = quantityFromUnionStaRanges(
          task.taskMaster.unit,
          t.approvedRanges,
          cf,
        );
      }
      if (t.pendingRanges.length) {
        pending = quantityFromUnionStaRanges(
          task.taskMaster.unit,
          t.pendingRanges,
          cf,
        );
      }
    }

    const capped = capReportedTotals(approved, pending, estimated);
    result.set(task.id, {
      estimated,
      approved: capped.approved,
      pending: capped.pending,
      approvedPct: pct(capped.approved, capped.pending, estimated),
    });
  }

  return result;
}
