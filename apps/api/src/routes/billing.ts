import { Router } from "express";
import { prisma } from "@frs/db";
import { APPROVED_REPORT_STATUSES } from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const billingRouter = Router();

billingRouter.use(requireAuth);

const approvedStatuses = [...APPROVED_REPORT_STATUSES] as (
  | "APPROVED"
  | "APPROVED_WITH_NOTES"
)[];

/** Project rollup for Project Admin billing dashboard (FRD §8.6) */
billingRouter.get(
  "/rollup",
  requirePermission("reports.view_approved"),
  asyncHandler(async (_req, res) => {
    const projects = await prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        jobNumber: true,
        name: true,
        location: true,
        division: true,
        clientName: true,
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

    res.json({
      projects: projects.map((p) => {
        const stats = byProject.get(p.id)!;
        const billingReady =
          stats.approvedCount > 0 && stats.pendingCount === 0;
        return {
          ...p,
          ...stats,
          billingReady,
          billingReadinessFlag: billingReady ? "READY" : "WAITING",
        };
      }),
    });
  }),
);

/**
 * Approved-only project drilldown — pending/returned details are not exposed
 * (Project Admin sees counts on rollup only).
 */
billingRouter.get(
  "/projects/:projectId",
  requirePermission("reports.view_approved"),
  asyncHandler(async (req, res) => {
    const projectId = routeParam(req.params.projectId);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        jobNumber: true,
        name: true,
        location: true,
        division: true,
        clientName: true,
        generalContractor: true,
      },
    });
    if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

    const pendingCount = await prisma.report.count({
      where: { projectId, status: "SUBMITTED" },
    });

    const reports = await prisma.report.findMany({
      where: { projectId, status: { in: approvedStatuses } },
      include: {
        submittedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        lineItems: {
          include: {
            projectTask: {
              include: {
                taskMaster: {
                  select: {
                    code: true,
                    name: true,
                    unit: true,
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        attachments: {
          orderBy: { uploadedAt: "desc" },
        },
      },
      orderBy: [{ reportDate: "desc" }, { reportNumber: "desc" }],
    });

    const quantityByBid = new Map<
      string,
      { code: string; name: string; unit: string; quantity: number }
    >();
    for (const r of reports) {
      for (const li of r.lineItems) {
        const tm = li.projectTask.taskMaster;
        const key = tm.code;
        const prev = quantityByBid.get(key);
        const qty = Number(li.finalQuantity);
        if (prev) prev.quantity += qty;
        else {
          quantityByBid.set(key, {
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
        pendingCount,
        billingReady: reports.length > 0 && pendingCount === 0,
      },
      quantitiesByBidItem: [...quantityByBid.values()].sort((a, b) =>
        a.code.localeCompare(b.code),
      ),
      reports: reports.map((r) => ({
        id: r.id,
        reportNumber: r.reportNumber,
        reportDate: r.reportDate.toISOString().slice(0, 10),
        status: r.status,
        approvalNotes: r.approvalNotes,
        approvedAt: r.approvedAt,
        submittedBy: {
          id: r.submittedBy.id,
          name: `${r.submittedBy.firstName} ${r.submittedBy.lastName}`.trim(),
        },
        approvedBy: r.approvedBy
          ? {
              id: r.approvedBy.id,
              name: `${r.approvedBy.firstName} ${r.approvedBy.lastName}`.trim(),
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

/** CSV billing backup for approved lines (FRD §8.6) */
billingRouter.get(
  "/projects/:projectId/export.csv",
  requirePermission("billing.export"),
  asyncHandler(async (req, res) => {
    const projectId = routeParam(req.params.projectId);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, jobNumber: true, name: true },
    });
    if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

    const reports = await prisma.report.findMany({
      where: { projectId, status: { in: approvedStatuses } },
      include: {
        submittedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        lineItems: {
          include: {
            projectTask: {
              include: {
                taskMaster: {
                  select: { code: true, name: true, unit: true },
                },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ reportDate: "asc" }, { reportNumber: "asc" }],
    });

    const escape = (v: string | number | null | undefined) => {
      const s = v == null ? "" : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const headers = [
      "JobNumber",
      "ProjectName",
      "ReportNumber",
      "ReportDate",
      "Status",
      "Lead",
      "LeadEmail",
      "LineCode",
      "LineName",
      "Unit",
      "Quantity",
      "EntryType",
      "BeginSTA",
      "EndSTA",
      "Location",
      "Symbol",
    ];

    const rows: string[] = [headers.join(",")];
    for (const r of reports) {
      const lead = `${r.submittedBy.firstName} ${r.submittedBy.lastName}`.trim();
      for (const li of r.lineItems) {
        const tm = li.projectTask.taskMaster;
        rows.push(
          [
            escape(project.jobNumber),
            escape(project.name),
            escape(r.reportNumber),
            escape(r.reportDate.toISOString().slice(0, 10)),
            escape(r.status),
            escape(lead),
            escape(r.submittedBy.email),
            escape(tm.code),
            escape(tm.name),
            escape(tm.unit),
            escape(Number(li.finalQuantity)),
            escape(li.entryType),
            escape(li.beginSta),
            escape(li.endSta),
            escape(li.locationDescription),
            escape(li.symbolItemType),
          ].join(","),
        );
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "EXPORTED",
        comment: `Billing CSV export for ${project.jobNumber} (${reports.length} approved reports)`,
        metadata: { projectId, reportCount: reports.length },
      },
    });

    const filename = `${project.jobNumber}-billing-backup.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.send(rows.join("\n"));
  }),
);
