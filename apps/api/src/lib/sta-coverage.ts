import { prisma } from "@frs/db";

const LOCKED_REPORT_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "APPROVED_WITH_NOTES",
] as const;

export type CompletedStaRange = {
  beginSta: string;
  endSta: string;
  reportNumber: string;
};

/** STA ranges already submitted or approved for project tasks (excludes drafts/returns). */
export async function fetchCompletedStaRanges(
  projectTaskIds: string[],
  excludeReportId?: string,
): Promise<Map<string, CompletedStaRange[]>> {
  const map = new Map<string, CompletedStaRange[]>();
  if (projectTaskIds.length === 0) return map;

  const items = await prisma.reportLineItem.findMany({
    where: {
      projectTaskId: { in: projectTaskIds },
      beginSta: { not: null },
      endSta: { not: null },
      report: {
        status: { in: [...LOCKED_REPORT_STATUSES] },
        ...(excludeReportId ? { id: { not: excludeReportId } } : {}),
      },
    },
    select: {
      projectTaskId: true,
      beginSta: true,
      endSta: true,
      report: { select: { reportNumber: true } },
    },
    orderBy: [{ report: { reportDate: "asc" } }, { sortOrder: "asc" }],
  });

  for (const item of items) {
    if (!item.beginSta || !item.endSta) continue;
    const list = map.get(item.projectTaskId) ?? [];
    list.push({
      beginSta: item.beginSta,
      endSta: item.endSta,
      reportNumber: item.report.reportNumber,
    });
    map.set(item.projectTaskId, list);
  }

  return map;
}
