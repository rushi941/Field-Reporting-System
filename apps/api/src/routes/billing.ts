import { Router } from "express";
import { prisma } from "@frs/db";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";
import { projectManageScopeWhere, assertCanManageProject } from "../lib/project-scope.js";
import {
  assertBillingExportReady,
  loadApprovedBillingExport,
} from "../lib/billing-export-data.js";
import { buildBillingPackageCsv } from "../lib/billing-csv.js";
import { isoDate, personName, sendCsv } from "../lib/csv-utils.js";

export const billingRouter = Router();

billingRouter.use(requireAuth);

async function auditBillingExport(
  userId: string,
  project: { jobNumber: string; id: string },
  reportCount: number,
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action: "EXPORTED",
      comment: `Billing backup export for ${project.jobNumber} (${reportCount} approved reports)`,
      metadata: { projectId: project.id, exportType: "package", reportCount },
    },
  });
}

/** Nav badge: total pending approvals across active projects */
billingRouter.get(
  "/summary",
  requirePermission("billing.export"),
  asyncHandler(async (req, res) => {
    const projectScope = {
      status: "ACTIVE" as const,
      ...projectManageScopeWhere(req.user!.id, req.user!.roles),
    };
    const pendingCount = await prisma.report.count({
      where: { status: "SUBMITTED", project: projectScope },
    });
    const pendingGroups = await prisma.report.groupBy({
      by: ["projectId"],
      where: { status: "SUBMITTED", project: projectScope },
      _count: { _all: true },
    });
    res.json({
      totalPending: pendingCount,
      projectsWithPending: pendingGroups.length,
      projects: pendingGroups.map((g) => ({
        id: g.projectId,
        pendingCount: g._count._all,
      })),
    });
  }),
);

/** Project rollup for Project Admin billing dashboard (FRD §8.6) */
billingRouter.get(
  "/rollup",
  requirePermission("billing.export"),
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: {
        status: "ACTIVE",
        ...projectManageScopeWhere(req.user!.id, req.user!.roles),
      },
      select: {
        id: true,
        jobNumber: true,
        name: true,
        location: true,
        division: true,
        clientName: true,
        generalContractor: true,
        contractAmount: true,
      },
      orderBy: { jobNumber: "asc" },
    });

    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) {
      res.json({ projects: [] });
      return;
    }

    const groups = await prisma.report.groupBy({
      by: ["projectId", "status"],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
      _max: { reportDate: true, approvedAt: true },
    });

    const byProject = new Map<
      string,
      {
        approvedCount: number;
        pendingCount: number;
        returnedCount: number;
        lastReportDate: string | null;
        lastApprovedAt: string | null;
      }
    >();

    for (const id of projectIds) {
      byProject.set(id, {
        approvedCount: 0,
        pendingCount: 0,
        returnedCount: 0,
        lastReportDate: null,
        lastApprovedAt: null,
      });
    }

    for (const g of groups) {
      const row = byProject.get(g.projectId);
      if (!row) continue;
      const count = g._count._all;
      if (g.status === "APPROVED" || g.status === "APPROVED_WITH_NOTES") {
        row.approvedCount += count;
      } else if (g.status === "SUBMITTED") {
        row.pendingCount += count;
      } else if (g.status === "RETURNED") {
        row.returnedCount += count;
      }
      const d = g._max.reportDate;
      if (d) {
        const iso = d.toISOString().slice(0, 10);
        if (!row.lastReportDate || iso > row.lastReportDate) {
          row.lastReportDate = iso;
        }
      }
      const a = g._max.approvedAt;
      if (a) {
        const iso = a.toISOString();
        if (!row.lastApprovedAt || iso > row.lastApprovedAt) {
          row.lastApprovedAt = iso;
        }
      }
    }

    const rollup = projects.map((p) => {
      const stats = byProject.get(p.id)!;
      const billingReady =
        stats.approvedCount > 0 && stats.pendingCount === 0;
      return {
        ...p,
        contractAmount:
          p.contractAmount != null ? Number(p.contractAmount) : null,
        ...stats,
        billingReady,
        billingReadinessFlag: billingReady ? "READY" : "WAITING",
      };
    });

    rollup.sort((a, b) => {
      if (a.billingReady !== b.billingReady) {
        return a.billingReady ? -1 : 1;
      }
      if (a.pendingCount !== b.pendingCount) {
        return b.pendingCount - a.pendingCount;
      }
      return a.jobNumber.localeCompare(b.jobNumber);
    });

    res.json({ projects: rollup });
  }),
);

/** Approved-only project drilldown */
billingRouter.get(
  "/projects/:projectId",
  requirePermission("billing.export"),
  asyncHandler(async (req, res) => {
    const projectId = routeParam(req.params.projectId);
    const owned = await prisma.project.findUnique({
      where: { id: projectId },
      select: { projectAdminId: true },
    });
    if (!owned) throw new AppError("NOT_FOUND", "Project not found", 404);
    assertCanManageProject(
      owned.projectAdminId,
      req.user!.id,
      req.user!.roles,
    );
    const { project, reports, pendingCount, billingReady } =
      await loadApprovedBillingExport(projectId);

    const quantityByBid = new Map<
      string,
      { code: string; name: string; unit: string; quantity: number }
    >();
    for (const r of reports) {
      for (const li of r.lineItems) {
        const tm = li.projectTask.taskMaster;
        const prev = quantityByBid.get(tm.code);
        const qty = Number(li.finalQuantity);
        if (prev) prev.quantity += qty;
        else {
          quantityByBid.set(tm.code, {
            code: tm.code,
            name: tm.name,
            unit: tm.unit,
            quantity: qty,
          });
        }
      }
    }

    res.json({
      project: {
        ...project,
        contractAmount:
          project.contractAmount != null ? Number(project.contractAmount) : null,
        startDate: isoDate(project.startDate),
        endDate: isoDate(project.endDate),
        pendingCount,
        billingReady,
        approvedReportCount: reports.length,
      },
      quantitiesByBidItem: [...quantityByBid.values()].sort((a, b) =>
        a.code.localeCompare(b.code),
      ),
      reports: reports.map((r) => ({
        id: r.id,
        reportNumber: r.reportNumber,
        reportDate: isoDate(r.reportDate),
        status: r.status,
        crewSize: r.crewSize,
        notes: r.notes,
        approvalNotes: r.approvalNotes,
        approvedAt: r.approvedAt,
        submittedBy: {
          name: personName(r.submittedBy),
          email: r.submittedBy.email,
        },
        approvedBy: r.approvedBy
          ? {
              name: personName(r.approvedBy),
              email: r.approvedBy.email,
            }
          : null,
        lineItems: r.lineItems.map((li) => ({
          id: li.id,
          code: li.projectTask.taskMaster.code,
          name: li.projectTask.taskMaster.name,
          unit: li.projectTask.taskMaster.unit,
          finalQuantity: Number(li.finalQuantity),
          entryType: li.entryType,
          beginSta: li.beginSta,
          endSta: li.endSta,
          locationDescription: li.locationDescription,
          symbolItemType: li.symbolItemType,
        })),
        attachments: r.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileType: a.fileType,
          category: a.category,
          storageUrl: a.storageUrl,
          uploadedAt: a.uploadedAt,
        })),
      })),
    });
  }),
);

/** Full pay-app backup CSV — job info, summary, reports, line detail, attachments */
billingRouter.get(
  "/projects/:projectId/export.csv",
  requirePermission("billing.export"),
  asyncHandler(async (req, res) => {
    const projectId = routeParam(req.params.projectId);
    const owned = await prisma.project.findUnique({
      where: { id: projectId },
      select: { projectAdminId: true },
    });
    if (!owned) throw new AppError("NOT_FOUND", "Project not found", 404);
    assertCanManageProject(
      owned.projectAdminId,
      req.user!.id,
      req.user!.roles,
    );
    const { project, reports, pendingCount, approvedCount } =
      await loadApprovedBillingExport(projectId);
    assertBillingExportReady(pendingCount, approvedCount);

    const rows = buildBillingPackageCsv(project, reports);
    await auditBillingExport(req.user!.id, project, reports.length);
    sendCsv(res, `${project.jobNumber}-billing-backup.csv`, rows);
  }),
);
