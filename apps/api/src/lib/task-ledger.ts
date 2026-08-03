import { prisma } from "@frs/db";
import { APPROVED_REPORT_STATUSES } from "@frs/shared";

export type LedgerRow = {
  id: string;
  reportId: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  submittedBy: string;
  beginSta: string | null;
  endSta: string | null;
  locationDescription: string | null;
  lineTypeCode: string | null;
  side: string | null;
  conversionFactor: number | null;
  todayQuantity: number;
  toDateQuantity: number;
  unit: string;
};

export type LedgerGroup = {
  reportId: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  submittedBy: string;
  rows: Omit<LedgerRow, "reportId" | "reportNumber" | "reportDate" | "status" | "submittedBy">[];
  groupTotal: number;
};

type LedgerQuery = {
  projectTaskId: string;
  statusFilter: "all" | "approved" | "pending";
  approvedOnlyForToDate: boolean;
};

function statusWhere(filter: LedgerQuery["statusFilter"]) {
  if (filter === "approved") {
    return { in: [...APPROVED_REPORT_STATUSES] };
  }
  if (filter === "pending") {
    return { in: ["SUBMITTED"] as const };
  }
  return { not: "DRAFT" as const };
}

export async function fetchTaskLedger(
  query: LedgerQuery,
): Promise<{ unit: string; rows: LedgerRow[] }> {
  const task = await prisma.projectTask.findUnique({
    where: { id: query.projectTaskId },
    include: { taskMaster: { select: { unit: true } } },
  });
  if (!task) {
    return { unit: "LF", rows: [] };
  }

  const unit = task.taskMaster.unit;

  const approvedItems = await prisma.reportLineItem.findMany({
    where: {
      projectTaskId: query.projectTaskId,
      report: { status: { in: [...APPROVED_REPORT_STATUSES] } },
    },
    include: {
      report: {
        select: {
          id: true,
          reportNumber: true,
          reportDate: true,
          status: true,
          submittedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [
      { report: { reportDate: "asc" } },
      { report: { createdAt: "asc" } },
      { sortOrder: "asc" },
    ],
  });

  let running = 0;
  const approvedToDateByItemId = new Map<string, number>();
  for (const item of approvedItems) {
    running += Number(item.finalQuantity);
    approvedToDateByItemId.set(item.id, running);
  }
  const lastApprovedTotal = running;

  const displayItems = await prisma.reportLineItem.findMany({
    where: {
      projectTaskId: query.projectTaskId,
      report: { status: statusWhere(query.statusFilter) },
    },
    include: {
      report: {
        select: {
          id: true,
          reportNumber: true,
          reportDate: true,
          status: true,
          submittedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [
      { report: { reportDate: "asc" } },
      { report: { createdAt: "asc" } },
      { sortOrder: "asc" },
    ],
  });

  const rows: LedgerRow[] = displayItems.map((item) => {
    const qty = Number(item.finalQuantity);
    const isApproved = APPROVED_REPORT_STATUSES.includes(
      item.report.status as (typeof APPROVED_REPORT_STATUSES)[number],
    );
    const toDate = isApproved
      ? (approvedToDateByItemId.get(item.id) ?? lastApprovedTotal)
      : lastApprovedTotal;

    return {
      id: item.id,
      reportId: item.report.id,
      reportNumber: item.report.reportNumber,
      reportDate: item.report.reportDate.toISOString().slice(0, 10),
      status: item.report.status,
      submittedBy: `${item.report.submittedBy.firstName} ${item.report.submittedBy.lastName}`.trim(),
      beginSta: item.beginSta,
      endSta: item.endSta,
      locationDescription: item.locationDescription,
      lineTypeCode: item.lineTypeCode,
      side: item.side,
      conversionFactor:
        item.conversionFactor != null ? Number(item.conversionFactor) : null,
      todayQuantity: qty,
      toDateQuantity: toDate,
      unit,
    };
  });

  return { unit, rows };
}

export function groupLedgerRows(rows: LedgerRow[]): LedgerGroup[] {
  const groups = new Map<string, LedgerGroup>();

  for (const row of rows) {
    let group = groups.get(row.reportId);
    if (!group) {
      group = {
        reportId: row.reportId,
        reportNumber: row.reportNumber,
        reportDate: row.reportDate,
        status: row.status,
        submittedBy: row.submittedBy,
        rows: [],
        groupTotal: 0,
      };
      groups.set(row.reportId, group);
    }
    group.rows.push({
      id: row.id,
      beginSta: row.beginSta,
      endSta: row.endSta,
      locationDescription: row.locationDescription,
      lineTypeCode: row.lineTypeCode,
      side: row.side,
      conversionFactor: row.conversionFactor,
      todayQuantity: row.todayQuantity,
      toDateQuantity: row.toDateQuantity,
      unit: row.unit,
    });
    group.groupTotal += row.todayQuantity;
  }

  return [...groups.values()].sort((a, b) =>
    b.reportDate.localeCompare(a.reportDate),
  );
}
