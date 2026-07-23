import { Router } from "express";
import { prisma, type Prisma } from "@frs/db";
import {
  approveReportSchema,
  approveWithNotesSchema,
  formatReportAge,
  reportAgeHours,
  returnReportSchema,
} from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const approvalsRouter = Router();

approvalsRouter.use(requireAuth);

const queueInclude = {
  project: {
    select: {
      id: true,
      jobNumber: true,
      name: true,
      location: true,
      division: true,
    },
  },
  submittedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      managerId: true,
      division: true,
    },
  },
  _count: { select: { lineItems: true, attachments: true } },
} as const;

const detailInclude = {
  ...queueInclude,
  lineItems: {
    include: {
      projectTask: {
        include: {
          taskMaster: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              formType: true,
              color: true,
              widthInches: true,
              conversionFactor: true,
            },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  attachments: {
    orderBy: { uploadedAt: "desc" as const },
  },
  auditLogs: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
} as const;

type QueueRow = Prisma.ReportGetPayload<{ include: typeof queueInclude }>;
type DetailRow = Prisma.ReportGetPayload<{ include: typeof detailInclude }>;

async function managerScopeWhere(
  userId: string,
  roles: string[],
): Promise<Prisma.ReportWhereInput> {
  if (roles.includes("SYSTEM_ADMIN")) return {};

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { division: true },
  });

  const or: Prisma.ReportWhereInput[] = [
    { submittedBy: { managerId: userId } },
    { project: { projectManagerId: userId } },
  ];
  if (me?.division) {
    or.push({ division: me.division });
  }

  return { OR: or };
}

/** Active projects a division manager can view in history. */
async function managerProjectScopeWhere(
  userId: string,
  roles: string[],
): Promise<Prisma.ProjectWhereInput> {
  if (roles.includes("SYSTEM_ADMIN")) {
    return { status: "ACTIVE" };
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { division: true },
  });

  const or: Prisma.ProjectWhereInput[] = [
    { projectManagerId: userId },
    {
      tasks: {
        some: { isActive: true, assignedTo: { managerId: userId } },
      },
    },
    {
      reports: {
        some: {
          status: { not: "DRAFT" },
          submittedBy: { managerId: userId },
        },
      },
    },
  ];
  if (me?.division) {
    or.push({ division: me.division });
    or.push({ extraDivisions: { has: me.division } });
  }

  return { status: "ACTIVE", OR: or };
}

const historyTaskInclude = {
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  taskMaster: {
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      formType: true,
      color: true,
      widthInches: true,
      conversionFactor: true,
    },
  },
} as const;

type HistoryTaskRow = Prisma.ProjectTaskGetPayload<{
  include: typeof historyTaskInclude;
}>;

function mapHistoryTask(t: HistoryTaskRow) {
  return {
    id: t.id,
    division: t.division,
    sortOrder: t.sortOrder,
    assignedTo: t.assignedTo
      ? {
          id: t.assignedTo.id,
          name: `${t.assignedTo.firstName} ${t.assignedTo.lastName}`.trim(),
          email: t.assignedTo.email,
        }
      : null,
    taskMaster: {
      ...t.taskMaster,
      conversionFactor:
        t.taskMaster.conversionFactor != null
          ? Number(t.taskMaster.conversionFactor)
          : null,
    },
  };
}

function withAge(r: QueueRow, now = new Date()) {
  const ageHours = reportAgeHours(r.submittedAt ?? r.createdAt, now);
  return {
    id: r.id,
    reportNumber: r.reportNumber,
    reportDate: r.reportDate.toISOString().slice(0, 10),
    status: r.status,
    division: r.division,
    submittedAt: r.submittedAt,
    lineCount: r._count.lineItems,
    attachmentCount: r._count.attachments,
    project: r.project,
    submittedBy: {
      id: r.submittedBy.id,
      name: `${r.submittedBy.firstName} ${r.submittedBy.lastName}`.trim(),
      email: r.submittedBy.email,
    },
    ageHours: Math.round(ageHours * 10) / 10,
    ageLabel: formatReportAge(ageHours),
  };
}

function mapDetail(r: DetailRow) {
  return {
    ...withAge(r),
    crewSize: r.crewSize,
    notes: r.notes,
    returnComment: r.returnComment,
    approvalNotes: r.approvalNotes,
    lineItems: r.lineItems.map((li) => ({
      id: li.id,
      entryType: li.entryType,
      quantitySource: li.quantitySource,
      beginSta: li.beginSta,
      endSta: li.endSta,
      conversionFactor:
        li.conversionFactor != null ? Number(li.conversionFactor) : null,
      calculatedLf: li.calculatedLf != null ? Number(li.calculatedLf) : null,
      manualLf: li.manualLf != null ? Number(li.manualLf) : null,
      finalQuantity: Number(li.finalQuantity),
      locationDescription: li.locationDescription,
      symbolItemType: li.symbolItemType,
      taskMaster: {
        ...li.projectTask.taskMaster,
        conversionFactor:
          li.projectTask.taskMaster.conversionFactor != null
            ? Number(li.projectTask.taskMaster.conversionFactor)
            : null,
      },
    })),
    attachments: r.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileType: a.fileType,
      category: a.category,
      storageUrl: a.storageUrl,
      uploadedAt: a.uploadedAt,
    })),
    auditLogs: r.auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      comment: a.comment,
      createdAt: a.createdAt,
      user: a.user
        ? {
            id: a.user.id,
            name: `${a.user.firstName} ${a.user.lastName}`.trim(),
          }
        : null,
    })),
  };
}

/** Pending count (in-app notification / badge) */
approvalsRouter.get(
  "/summary",
  requirePermission("reports.view_pending_queue"),
  asyncHandler(async (req, res) => {
    const scope = await managerScopeWhere(req.user!.id, req.user!.roles);
    const pendingCount = await prisma.report.count({
      where: { status: "SUBMITTED", ...scope },
    });
    res.json({
      pendingCount,
      hasPendingNotification: pendingCount > 0,
    });
  }),
);

/**
 * Project-specific report history for managers.
 * Query: ?projectId= required
 */
approvalsRouter.get(
  "/history",
  requirePermission("reports.view_project_history"),
  asyncHandler(async (req, res) => {
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId.trim() : "";
    if (!projectId) {
      throw new AppError("VALIDATION_ERROR", "projectId is required", 400);
    }
    const scope = await managerScopeWhere(req.user!.id, req.user!.roles);
    const projectScope = await managerProjectScopeWhere(
      req.user!.id,
      req.user!.roles,
    );
    const project = await prisma.project.findFirst({
      where: { id: projectId, ...projectScope },
      select: {
        id: true,
        jobNumber: true,
        name: true,
        location: true,
        division: true,
        clientName: true,
        tasks: {
          where: { isActive: true },
          include: historyTaskInclude,
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

    const reports = await prisma.report.findMany({
      where: {
        projectId,
        status: { not: "DRAFT" },
        ...scope,
      },
      include: {
        ...queueInclude,
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ reportDate: "desc" }, { submittedAt: "desc" }],
      take: 100,
    });

    res.json({
      project: {
        id: project.id,
        jobNumber: project.jobNumber,
        name: project.name,
        location: project.location,
        division: project.division,
        clientName: project.clientName,
      },
      tasks: project.tasks.map(mapHistoryTask),
      reports: reports.map((r) => ({
        ...withAge(r),
        approvedAt: r.approvedAt,
        returnedAt: r.returnedAt,
        approvalNotes: r.approvalNotes,
        returnComment: r.returnComment,
        approvedBy: r.approvedBy
          ? {
              id: r.approvedBy.id,
              name: `${r.approvedBy.firstName} ${r.approvedBy.lastName}`.trim(),
            }
          : null,
      })),
    });
  }),
);

/** FR-MGR pending queue */
approvalsRouter.get(
  "/pending",
  requirePermission("reports.view_pending_queue"),
  asyncHandler(async (req, res) => {
    const scope = await managerScopeWhere(req.user!.id, req.user!.roles);
    const reports = await prisma.report.findMany({
      where: { status: "SUBMITTED", ...scope },
      include: queueInclude,
      orderBy: [{ submittedAt: "asc" }, { reportNumber: "asc" }],
    });
    const mapped = reports.map((r) => withAge(r));
    res.json({
      reports: mapped,
      pendingCount: mapped.length,
    });
  }),
);

/** Projects in manager scope (history picker) */
approvalsRouter.get(
  "/projects",
  requirePermission("reports.view_project_history"),
  asyncHandler(async (req, res) => {
    const projectScope = await managerProjectScopeWhere(
      req.user!.id,
      req.user!.roles,
    );
    const projects = await prisma.project.findMany({
      where: projectScope,
      select: {
        id: true,
        jobNumber: true,
        name: true,
        location: true,
        division: true,
        clientName: true,
        _count: {
          select: {
            tasks: { where: { isActive: true } },
            reports: { where: { status: { not: "DRAFT" } } },
          },
        },
      },
      orderBy: { jobNumber: "asc" },
    });
    res.json({
      projects: projects.map((p) => ({
        id: p.id,
        jobNumber: p.jobNumber,
        name: p.name,
        location: p.location,
        division: p.division,
        clientName: p.clientName,
        taskCount: p._count.tasks,
        reportCount: p._count.reports,
      })),
    });
  }),
);

approvalsRouter.get(
  "/:id",
  requirePermission("reports.view_pending_queue"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const scope = await managerScopeWhere(req.user!.id, req.user!.roles);
    const report = await prisma.report.findFirst({
      where: { id, ...scope },
      include: detailInclude,
    });
    if (!report) throw new AppError("NOT_FOUND", "Report not found", 404);
    res.json({ report: mapDetail(report) });
  }),
);

approvalsRouter.post(
  "/:id/approve",
  requirePermission("reports.approve"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const body = approveReportSchema.parse(req.body ?? {});
    const scope = await managerScopeWhere(req.user!.id, req.user!.roles);
    const report = await prisma.report.findFirst({
      where: { id, status: "SUBMITTED", ...scope },
    });
    if (!report) {
      throw new AppError("NOT_FOUND", "Pending report not found", 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.report.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvalNotes: body.notes?.trim() || null,
          returnComment: null,
          approvedAt: new Date(),
          approvedById: req.user!.id,
        },
        include: detailInclude,
      });
      await tx.auditLog.create({
        data: {
          reportId: id,
          userId: req.user!.id,
          action: "APPROVED",
          comment: body.notes?.trim() || "Report approved",
        },
      });
      return next;
    });

    res.json({ report: mapDetail(updated) });
  }),
);

approvalsRouter.post(
  "/:id/approve-with-notes",
  requirePermission("reports.approve_with_notes"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const body = approveWithNotesSchema.parse(req.body ?? {});
    const scope = await managerScopeWhere(req.user!.id, req.user!.roles);
    const report = await prisma.report.findFirst({
      where: { id, status: "SUBMITTED", ...scope },
    });
    if (!report) {
      throw new AppError("NOT_FOUND", "Pending report not found", 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.report.update({
        where: { id },
        data: {
          status: "APPROVED_WITH_NOTES",
          approvalNotes: body.notes,
          returnComment: null,
          approvedAt: new Date(),
          approvedById: req.user!.id,
        },
        include: detailInclude,
      });
      await tx.auditLog.create({
        data: {
          reportId: id,
          userId: req.user!.id,
          action: "APPROVED_WITH_NOTES",
          comment: body.notes,
        },
      });
      return next;
    });

    res.json({ report: mapDetail(updated) });
  }),
);

approvalsRouter.post(
  "/:id/return",
  requirePermission("reports.return"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const body = returnReportSchema.parse(req.body ?? {});
    const scope = await managerScopeWhere(req.user!.id, req.user!.roles);
    const report = await prisma.report.findFirst({
      where: { id, status: "SUBMITTED", ...scope },
    });
    if (!report) {
      throw new AppError("NOT_FOUND", "Pending report not found", 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.report.update({
        where: { id },
        data: {
          status: "RETURNED",
          returnComment: body.comment,
          returnedAt: new Date(),
          approvedAt: null,
          approvedById: null,
          approvalNotes: null,
        },
        include: detailInclude,
      });
      await tx.auditLog.create({
        data: {
          reportId: id,
          userId: req.user!.id,
          action: "RETURNED",
          comment: body.comment,
        },
      });
      return next;
    });

    res.json({ report: mapDetail(updated) });
  }),
);
