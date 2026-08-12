import { Router } from "express";
import { prisma, type Prisma } from "@frs/db";
import {
  formatReportAge,
  reportAgeHours,
} from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";
import {
  buildWorkspacePackageCsv,
  loadWorkspaceProjectForExport,
  loadWorkspaceReportsForExport,
} from "../lib/workspace-reports-csv.js";
import {
  fetchTaskLedger,
  groupLedgerRows,
} from "../lib/task-ledger.js";
import { fetchTaskProgressMap } from "../lib/task-progress.js";

export const workspaceReportsRouter = Router();

workspaceReportsRouter.use(requireAuth);

/** Workspace admins track submitted workflow only — drafts stay with field leads. */
const workspaceReportStatusWhere = { not: "DRAFT" as const };

/** System admin sees all active projects; project admin sees assigned jobs only. */
function workspaceProjectScopeWhere(
  userId: string,
  roles: string[],
): Prisma.ProjectWhereInput {
  if (roles.includes("SYSTEM_ADMIN")) {
    return { status: "ACTIVE" };
  }
  if (roles.includes("PROJECT_ADMIN")) {
    return { status: "ACTIVE", projectAdminId: userId };
  }
  return { status: "ACTIVE", projectAdminId: userId };
}

const reportListInclude = {
  submittedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  approvedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  _count: { select: { lineItems: true, attachments: true } },
} as const;

type ReportListRow = Prisma.ReportGetPayload<{
  include: typeof reportListInclude;
}>;

function mapReportRow(r: ReportListRow, now = new Date()) {
  const ageHours = reportAgeHours(r.submittedAt ?? r.createdAt, now);
  return {
    id: r.id,
    reportNumber: r.reportNumber,
    reportDate: r.reportDate.toISOString().slice(0, 10),
    status: r.status,
    crewSize: r.crewSize,
    submittedAt: r.submittedAt,
    approvedAt: r.approvedAt,
    returnedAt: r.returnedAt,
    returnComment: r.returnComment,
    approvalNotes: r.approvalNotes,
    lineCount: r._count.lineItems,
    attachmentCount: r._count.attachments,
    submittedBy: {
      id: r.submittedBy.id,
      name: `${r.submittedBy.firstName} ${r.submittedBy.lastName}`.trim(),
      email: r.submittedBy.email,
    },
    approvedBy: r.approvedBy
      ? {
          id: r.approvedBy.id,
          name: `${r.approvedBy.firstName} ${r.approvedBy.lastName}`.trim(),
        }
      : null,
    ageHours: Math.round(ageHours * 10) / 10,
    ageLabel: formatReportAge(ageHours),
  };
}

const reportHistoryInclude = {
  ...reportListInclude,
  project: {
    select: { id: true, jobNumber: true, name: true },
  },
} as const;

type ReportHistoryRow = Prisma.ReportGetPayload<{
  include: typeof reportHistoryInclude;
}>;

function mapHistoryReport(r: ReportHistoryRow, now = new Date()) {
  return {
    ...mapReportRow(r, now),
    project: {
      id: r.project.id,
      jobNumber: r.project.jobNumber,
      name: r.project.name,
    },
  };
}

function historyStatusWhere(
  raw: string,
): Prisma.EnumReportStatusFilter | undefined {
  const key = raw.trim().toLowerCase();
  if (!key || key === "all") return { not: "DRAFT" };
  if (key === "pending") return { in: ["SUBMITTED"] };
  if (key === "approved") return { in: ["APPROVED", "APPROVED_WITH_NOTES"] };
  if (key === "returned") return { in: ["RETURNED"] };
  return { not: "DRAFT" };
}

/** Approval history for project / system admins (view-only) */
workspaceReportsRouter.get(
  "/history",
  requirePermission("reports.view_project_history"),
  asyncHandler(async (req, res) => {
    const projectId =
      typeof req.query.projectId === "string"
        ? req.query.projectId.trim()
        : "";
    const statusKey =
      typeof req.query.status === "string" ? req.query.status : "all";
    const scope = workspaceProjectScopeWhere(req.user!.id, req.user!.roles);

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, ...scope },
        select: { id: true },
      });
      if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);
    }

    const baseWhere: Prisma.ReportWhereInput = {
      status: historyStatusWhere(statusKey),
      ...(projectId ? { projectId } : { project: scope }),
    };

    const reports = await prisma.report.findMany({
      where: baseWhere,
      include: reportHistoryInclude,
      orderBy: [{ reportDate: "desc" }, { submittedAt: "desc" }],
      take: 200,
    });

    const counts = await prisma.report.groupBy({
      by: ["status"],
      where: projectId ? { projectId } : { project: scope, status: { not: "DRAFT" } },
      _count: { _all: true },
    });

    let pending = 0;
    let approved = 0;
    let returned = 0;
    let all = 0;
    for (const row of counts) {
      const n = row._count._all;
      all += n;
      if (row.status === "SUBMITTED") pending += n;
      else if (row.status === "RETURNED") returned += n;
      else if (row.status === "APPROVED" || row.status === "APPROVED_WITH_NOTES") {
        approved += n;
      }
    }

    res.json({
      counts: { all, pending, approved, returned },
      reports: reports.map((r) => mapHistoryReport(r)),
    });
  }),
);

/** Project-wise report rollup for workspace admins */
workspaceReportsRouter.get(
  "/rollup",
  requirePermission("reports.view_project_history"),
  asyncHandler(async (req, res) => {
    const scope = workspaceProjectScopeWhere(req.user!.id, req.user!.roles);
    const projects = await prisma.project.findMany({
      where: scope,
      select: {
        id: true,
        jobNumber: true,
        name: true,
        location: true,
        division: true,
        clientName: true,
        generalContractor: true,
        startDate: true,
        endDate: true,
        projectAdmin: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: {
          select: {
            tasks: { where: { isActive: true } },
          },
        },
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
      where: { projectId: { in: projectIds }, status: workspaceReportStatusWhere },
      _count: { _all: true },
      _max: { reportDate: true },
    });

    const byProject = new Map<
      string,
      {
        pendingCount: number;
        returnedCount: number;
        approvedCount: number;
        totalCount: number;
        lastReportDate: string | null;
      }
    >();

    for (const id of projectIds) {
      byProject.set(id, {
        pendingCount: 0,
        returnedCount: 0,
        approvedCount: 0,
        totalCount: 0,
        lastReportDate: null,
      });
    }

    for (const g of groups) {
      const row = byProject.get(g.projectId);
      if (!row) continue;
      const count = g._count._all;
      row.totalCount += count;
      if (g.status === "SUBMITTED") row.pendingCount += count;
      else if (g.status === "RETURNED") row.returnedCount += count;
      else if (g.status === "APPROVED" || g.status === "APPROVED_WITH_NOTES") {
        row.approvedCount += count;
      }
      const d = g._max.reportDate;
      if (d) {
        const iso = d.toISOString().slice(0, 10);
        if (!row.lastReportDate || iso > row.lastReportDate) {
          row.lastReportDate = iso;
        }
      }
    }

    const rollup = projects.map((p) => {
      const stats = byProject.get(p.id)!;
      return {
        id: p.id,
        jobNumber: p.jobNumber,
        name: p.name,
        location: p.location,
        division: p.division,
        clientName: p.clientName,
        generalContractor: p.generalContractor,
        startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
        taskCount: p._count.tasks,
        projectAdmin: p.projectAdmin
          ? {
              id: p.projectAdmin.id,
              name: `${p.projectAdmin.firstName} ${p.projectAdmin.lastName}`.trim(),
              email: p.projectAdmin.email,
            }
          : null,
        ...stats,
        hasActivity: stats.totalCount > 0,
        needsAttention: stats.pendingCount > 0 || stats.returnedCount > 0,
      };
    });

    rollup.sort((a, b) => {
      if (a.needsAttention !== b.needsAttention) {
        return a.needsAttention ? -1 : 1;
      }
      if (a.pendingCount !== b.pendingCount) {
        return b.pendingCount - a.pendingCount;
      }
      return a.jobNumber.localeCompare(b.jobNumber);
    });

    res.json({ projects: rollup });
  }),
);

/** All field reports for one project (workspace tracking) */
workspaceReportsRouter.get(
  "/projects/:projectId",
  requirePermission("reports.view_project_history"),
  asyncHandler(async (req, res) => {
    const projectId = routeParam(req.params.projectId);
    const scope = workspaceProjectScopeWhere(req.user!.id, req.user!.roles);

    const project = await prisma.project.findFirst({
      where: { id: projectId, ...scope },
      select: {
        id: true,
        jobNumber: true,
        name: true,
        location: true,
        division: true,
        extraDivisions: true,
        clientName: true,
        generalContractor: true,
        startDate: true,
        endDate: true,
        status: true,
        projectAdmin: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        projectManager: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        tasks: {
          where: { isActive: true },
          select: {
            id: true,
            division: true,
            beginSta: true,
            endSta: true,
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
                conversionFactor: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        route: { select: { beginSta: true, endSta: true } },
      },
    });
    if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

    const taskIds = project.tasks.map((t) => t.id);
    const routesByProjectId = new Map([
      [
        project.id,
        project.route
          ? {
              beginSta: project.route.beginSta,
              endSta: project.route.endSta,
            }
          : null,
      ],
    ]);
    const projectIdForTask = new Map(
      project.tasks.map((t) => [t.id, project.id] as const),
    );
    const progressMap = await fetchTaskProgressMap(
      taskIds,
      project.tasks.map((t) => ({
        id: t.id,
        beginSta: t.beginSta,
        endSta: t.endSta,
        taskMaster: {
          unit: t.taskMaster.unit,
          formType: t.taskMaster.formType,
          conversionFactor:
            t.taskMaster.conversionFactor != null
              ? Number(t.taskMaster.conversionFactor)
              : null,
        },
      })),
      routesByProjectId,
      projectIdForTask,
    );

    const reports = await prisma.report.findMany({
      where: { projectId, status: workspaceReportStatusWhere },
      include: reportListInclude,
      orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    const statusCounts = {
      pending: 0,
      returned: 0,
      approved: 0,
      total: reports.length,
    };
    for (const r of reports) {
      if (r.status === "SUBMITTED") statusCounts.pending += 1;
      else if (r.status === "RETURNED") statusCounts.returned += 1;
      else if (r.status === "APPROVED" || r.status === "APPROVED_WITH_NOTES") {
        statusCounts.approved += 1;
      }
    }

    res.json({
      project: {
        id: project.id,
        jobNumber: project.jobNumber,
        name: project.name,
        location: project.location,
        division: project.division,
        extraDivisions: project.extraDivisions,
        clientName: project.clientName,
        generalContractor: project.generalContractor,
        startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: project.endDate?.toISOString().slice(0, 10) ?? null,
        status: project.status,
        projectAdmin: project.projectAdmin
          ? {
              id: project.projectAdmin.id,
              name: `${project.projectAdmin.firstName} ${project.projectAdmin.lastName}`.trim(),
              email: project.projectAdmin.email,
            }
          : null,
        projectManager: project.projectManager
          ? {
              id: project.projectManager.id,
              name: `${project.projectManager.firstName} ${project.projectManager.lastName}`.trim(),
              email: project.projectManager.email,
            }
          : null,
        taskCount: project.tasks.length,
      },
      tasks: project.tasks.map((t) => ({
        id: t.id,
        division: t.division,
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
        progress: progressMap.get(t.id) ?? {
          estimated: 0,
          approved: 0,
          pending: 0,
          approvedPct: 0,
        },
      })),
      statusCounts,
      reports: reports.map((r) => mapReportRow(r)),
    });
  }),
);

const reportDetailInclude = {
  project: {
    select: {
      id: true,
      jobNumber: true,
      name: true,
      location: true,
      projectAdminId: true,
    },
  },
  submittedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  approvedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
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
} as const;

type ReportDetailRow = Prisma.ReportGetPayload<{
  include: typeof reportDetailInclude;
}>;

function mapReportDetail(r: ReportDetailRow) {
  return {
    id: r.id,
    reportNumber: r.reportNumber,
    reportDate: r.reportDate.toISOString().slice(0, 10),
    status: r.status,
    crewSize: r.crewSize,
    notes: r.notes,
    returnComment: r.returnComment,
    approvalNotes: r.approvalNotes,
    submittedAt: r.submittedAt,
    approvedAt: r.approvedAt,
    returnedAt: r.returnedAt,
    project: {
      id: r.project.id,
      jobNumber: r.project.jobNumber,
      name: r.project.name,
      location: r.project.location,
    },
    submittedBy: {
      id: r.submittedBy.id,
      name: `${r.submittedBy.firstName} ${r.submittedBy.lastName}`.trim(),
      email: r.submittedBy.email,
    },
    approvedBy: r.approvedBy
      ? {
          id: r.approvedBy.id,
          name: `${r.approvedBy.firstName} ${r.approvedBy.lastName}`.trim(),
          email: r.approvedBy.email,
        }
      : null,
    lineItems: r.lineItems.map((li) => ({
      id: li.id,
      entryType: li.entryType,
      beginSta: li.beginSta,
      endSta: li.endSta,
      conversionFactor:
        li.conversionFactor != null ? Number(li.conversionFactor) : null,
      finalQuantity: Number(li.finalQuantity),
      locationDescription: li.locationDescription,
      symbolItemType: li.symbolItemType,
      taskMaster: li.projectTask.taskMaster,
    })),
    attachments: r.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileType: a.fileType,
      category: a.category,
      storageUrl: a.storageUrl,
    })),
  };
}

/** Read-only field report detail for project / system admins */
workspaceReportsRouter.get(
  "/reports/:reportId",
  requirePermission("reports.view_project_history"),
  asyncHandler(async (req, res) => {
    const reportId = routeParam(req.params.reportId);
    const scope = workspaceProjectScopeWhere(req.user!.id, req.user!.roles);

    const report = await prisma.report.findFirst({
      where: { id: reportId, project: scope, status: workspaceReportStatusWhere },
      include: reportDetailInclude,
    });
    if (!report) throw new AppError("NOT_FOUND", "Report not found", 404);

    res.json({ report: mapReportDetail(report) });
  }),
);

/** E026-style bid item ledger with running to-date totals */
workspaceReportsRouter.get(
  "/projects/:projectId/tasks/:projectTaskId/ledger",
  requirePermission("reports.view_project_history"),
  asyncHandler(async (req, res) => {
    const projectId = routeParam(req.params.projectId);
    const projectTaskId = routeParam(req.params.projectTaskId);
    const scope = workspaceProjectScopeWhere(req.user!.id, req.user!.roles);

    const task = await prisma.projectTask.findFirst({
      where: { id: projectTaskId, projectId, project: scope, isActive: true },
      include: {
        taskMaster: {
          select: { code: true, name: true, unit: true, formType: true },
        },
        project: { select: { jobNumber: true, name: true } },
      },
    });
    if (!task) throw new AppError("NOT_FOUND", "Task not found", 404);

    const rawStatus = String(req.query.status ?? "all").toLowerCase();
    const statusFilter =
      rawStatus === "approved" || rawStatus === "pending"
        ? rawStatus
        : "all";
    const view = String(req.query.view ?? "flat").toLowerCase() === "grouped"
      ? "grouped"
      : "flat";

    const { unit, rows } = await fetchTaskLedger({
      projectTaskId,
      statusFilter,
    });

    res.json({
      project: {
        id: projectId,
        jobNumber: task.project.jobNumber,
        name: task.project.name,
      },
      task: {
        id: task.id,
        taskMaster: task.taskMaster,
      },
      unit,
      view,
      statusFilter,
      flat: rows,
      grouped: view === "grouped" ? groupLedgerRows(rows) : undefined,
    });
  }),
);

/** Full project reports backup CSV */
workspaceReportsRouter.get(
  "/projects/:projectId/export.csv",
  requirePermission("reports.view_project_history"),
  asyncHandler(async (req, res) => {
    const projectId = routeParam(req.params.projectId);
    const scope = workspaceProjectScopeWhere(req.user!.id, req.user!.roles);
    const project = await loadWorkspaceProjectForExport(projectId, scope);
    const reports = await loadWorkspaceReportsForExport(projectId);
    const rows = buildWorkspacePackageCsv(project, reports);
    sendCsv(res, `${project.jobNumber}-project-reports.csv`, rows);
  }),
);
