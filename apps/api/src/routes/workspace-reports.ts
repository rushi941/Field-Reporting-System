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

export const workspaceReportsRouter = Router();

workspaceReportsRouter.use(requireAuth);

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
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
      _max: { reportDate: true },
    });

    const byProject = new Map<
      string,
      {
        draftCount: number;
        pendingCount: number;
        returnedCount: number;
        approvedCount: number;
        totalCount: number;
        lastReportDate: string | null;
      }
    >();

    for (const id of projectIds) {
      byProject.set(id, {
        draftCount: 0,
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
      if (g.status === "DRAFT") row.draftCount += count;
      else if (g.status === "SUBMITTED") row.pendingCount += count;
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
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

    const reports = await prisma.report.findMany({
      where: { projectId },
      include: reportListInclude,
      orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    const statusCounts = {
      draft: 0,
      pending: 0,
      returned: 0,
      approved: 0,
      total: reports.length,
    };
    for (const r of reports) {
      if (r.status === "DRAFT") statusCounts.draft += 1;
      else if (r.status === "SUBMITTED") statusCounts.pending += 1;
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
        taskMaster: t.taskMaster,
      })),
      statusCounts,
      reports: reports.map((r) => mapReportRow(r)),
    });
  }),
);
