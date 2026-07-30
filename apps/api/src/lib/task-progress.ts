import { physicalLfFromSta, reportedLfFromSta } from "@frs/shared";
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
    formType: string;
    conversionFactor: number | null;
  };
};

type RouteBounds = {
  beginSta: string | null;
  endSta: string | null;
} | null;

function estimateQuantity(
  task: TaskForEstimate,
  route: RouteBounds,
  totals: { approved: number; pending: number },
): number {
  const begin = task.beginSta ?? route?.beginSta;
  const end = task.endSta ?? route?.endSta;

  if (begin && end) {
    try {
      if (task.taskMaster.formType === "STA_RANGE") {
        const cf = Number(task.taskMaster.conversionFactor ?? 1);
        return reportedLfFromSta(begin, end, cf);
      }
      return physicalLfFromSta(begin, end);
    } catch {
      /* fall through */
    }
  }

  const floor = totals.approved + totals.pending;
  return floor > 0 ? floor : 0;
}

function pct(approved: number, estimated: number) {
  if (estimated <= 0) return 0;
  return Math.min(100, Math.round((approved / estimated) * 100));
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
    const qty = Number(row.finalQuantity);
    if (row.report.status === "SUBMITTED") bucket.pending += qty;
    else bucket.approved += qty;
  }

  for (const task of tasks) {
    const t = totals.get(task.id) ?? { approved: 0, pending: 0 };
    const projectId = projectIdForTask.get(task.id);
    const route = projectId ? routesByProjectId.get(projectId) ?? null : null;
    const estimated = estimateQuantity(task, route, t);
    result.set(task.id, {
      estimated,
      approved: t.approved,
      pending: t.pending,
      approvedPct: pct(t.approved, estimated),
    });
  }

  return result;
}
