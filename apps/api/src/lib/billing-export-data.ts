import { prisma } from "@frs/db";
import { APPROVED_REPORT_STATUSES } from "@frs/shared";
import { AppError } from "./app-error.js";

export const approvedStatuses = [...APPROVED_REPORT_STATUSES] as (
  | "APPROVED"
  | "APPROVED_WITH_NOTES"
)[];

const projectSelect = {
  id: true,
  jobNumber: true,
  name: true,
  location: true,
  division: true,
  clientName: true,
  generalContractor: true,
  contractAmount: true,
  startDate: true,
  endDate: true,
  notes: true,
} as const;

const reportInclude = {
  submittedBy: {
    select: { firstName: true, lastName: true, email: true },
  },
  approvedBy: {
    select: { firstName: true, lastName: true, email: true },
  },
  lineItems: {
    include: {
      projectTask: {
        include: {
          taskMaster: {
            select: { code: true, name: true, unit: true, division: true },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  attachments: {
    orderBy: { uploadedAt: "desc" as const },
  },
} as const;

export type BillingProject = Awaited<
  ReturnType<typeof loadApprovedBillingExport>
>["project"];

export type BillingReport = Awaited<
  ReturnType<typeof loadApprovedBillingExport>
>["reports"][number];

export async function loadApprovedBillingExport(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: projectSelect,
  });
  if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

  const [pendingCount, approvedCount, reports] = await Promise.all([
    prisma.report.count({
      where: { projectId, status: "SUBMITTED" },
    }),
    prisma.report.count({
      where: { projectId, status: { in: approvedStatuses } },
    }),
    prisma.report.findMany({
      where: { projectId, status: { in: approvedStatuses } },
      include: reportInclude,
      orderBy: [{ reportDate: "asc" }, { reportNumber: "asc" }],
    }),
  ]);

  return {
    project,
    reports,
    pendingCount,
    approvedCount,
    billingReady: approvedCount > 0 && pendingCount === 0,
  };
}

export function assertBillingExportReady(
  pendingCount: number,
  approvedCount: number,
) {
  if (approvedCount === 0 || pendingCount > 0) {
    throw new AppError(
      "BAD_REQUEST",
      "Billing export blocked — wait for pending approvals and ensure approved reports exist",
      400,
    );
  }
}
