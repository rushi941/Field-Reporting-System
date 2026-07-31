import { estimateTaskQuantity } from "@frs/shared";
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
      finalQuantity: true,
      report: { select: { status: true } },
    },
  });

  const totals = new Map<string, { approved: number; pending: number }>();
  for (const id of taskIds) {
    totals.set(id, { approved: 0, pending: 0 });
  }

  for (const row of rows) {
    const bucket = totals.get(row.projectTaskId);
    if (!bucket) continue;
    const task = tasks.find((t) => t.id === row.projectTaskId);
    const qty = normalizeStoredQuantity(
      task?.taskMaster.unit ?? "LF",
      Number(row.finalQuantity),
    );
    if (row.report.status === "SUBMITTED") bucket.pending += qty;
    else bucket.approved += qty;
  }

  for (const task of tasks) {
    const t = totals.get(task.id) ?? { approved: 0, pending: 0 };
    const projectId = projectIdForTask.get(task.id);
    const route = projectId ? routesByProjectId.get(projectId) ?? null : null;
    const estimated = estimateTaskQuantity({
      unit: task.taskMaster.unit,
      formType: task.taskMaster.formType,
      conversionFactor: task.taskMaster.conversionFactor,
      beginSta: task.beginSta,
      endSta: task.endSta,
      routeBeginSta: route?.beginSta,
      routeEndSta: route?.endSta,
      reportedApproved: t.approved,
      reportedPending: t.pending,
    });
    result.set(task.id, {
      estimated,
      approved: t.approved,
      pending: t.pending,
      approvedPct: pct(t.approved, t.pending, estimated),
    });
  }

  return result;
}
