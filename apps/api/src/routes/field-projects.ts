import { Router } from "express";
import { prisma } from "@frs/db";
import { projectDivisions } from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { fetchCompletedStaRanges } from "../lib/sta-coverage.js";
import { fetchTaskProgressMap } from "../lib/task-progress.js";
import {
  fetchLineTypesByMasterIds,
  fetchSymbolTypesByMasterIds,
  groupFieldTasksByMaster,
  resolveMasterId,
} from "../lib/master-tasks.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const fieldProjectsRouter = Router();

fieldProjectsRouter.use(requireAuth, requirePermission("projects.search"));

const fieldProjectInclude = {
  route: true,
  divisionManagers: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
  tasks: {
    where: { isActive: true },
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      taskMaster: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          formType: true,
          division: true,
          color: true,
          widthInches: true,
          conversionFactor: true,
          parentId: true,
          parent: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              formType: true,
              division: true,
            },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  projectType: { select: { code: true, name: true } },
} as const;

function fieldLeadAccessWhere(userId: string) {
  return {
    OR: [
      { fieldLeads: { some: { userId } } },
      {
        tasks: {
          some: {
            isActive: true,
            assignedToId: userId,
          },
        },
      },
    ],
  };
}

type FieldProjectRow = Awaited<
  ReturnType<
    typeof prisma.project.findMany<{ include: typeof fieldProjectInclude }>
  >
>[number];

async function buildFieldProjectPayload(
  projects: FieldProjectRow[],
  userId: string,
  isFieldLead: boolean,
) {
  const taskIds = projects.flatMap((p) =>
    (isFieldLead
      ? p.tasks.filter((t) => t.assignedToId === userId)
      : p.tasks
    ).map((t) => t.id),
  );
  const completedMap = await fetchCompletedStaRanges(taskIds);

  const projectIdForTask = new Map<string, string>();
  const routesByProjectId = new Map<
    string,
    { beginSta: string | null; endSta: string | null }
  >();
  const tasksForProgress: {
    id: string;
    beginSta: string | null;
    endSta: string | null;
    taskMaster: { unit: string; formType: string; conversionFactor: number | null };
  }[] = [];

  for (const p of projects) {
    routesByProjectId.set(p.id, {
      beginSta: p.route?.beginSta ?? null,
      endSta: p.route?.endSta ?? null,
    });
    const visibleTasks = isFieldLead
      ? p.tasks.filter((t) => t.assignedToId === userId)
      : p.tasks;
    for (const t of visibleTasks) {
      projectIdForTask.set(t.id, p.id);
      tasksForProgress.push({
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
      });
    }
  }

  const progressMap = await fetchTaskProgressMap(
    taskIds,
    tasksForProgress,
    routesByProjectId,
    projectIdForTask,
  );

  const masterIds = new Set<string>();
  const masterMeta = new Map<
    string,
    { code: string; name: string; division: string; unit: string; formType: string }
  >();
  for (const p of projects) {
    const visible = isFieldLead
      ? p.tasks.filter((t) => t.assignedToId === userId)
      : p.tasks;
    for (const t of visible) {
      const mid = resolveMasterId(t.taskMaster);
      masterIds.add(mid);
      const masterRow = t.taskMaster.parent ?? t.taskMaster;
      if (!masterMeta.has(mid)) {
        masterMeta.set(mid, {
          code: masterRow.code,
          name: masterRow.name,
          division: masterRow.division,
          unit: masterRow.unit,
          formType: masterRow.formType,
        });
      }
    }
  }
  const lineTypesByMaster = await fetchLineTypesByMasterIds([...masterIds]);
  const symbolTypesByMaster = await fetchSymbolTypesByMasterIds(
    [...masterIds],
    masterMeta,
  );

  return projects.map((p) => {
    const visibleTasks = isFieldLead
      ? p.tasks.filter((t) => t.assignedToId === userId)
      : p.tasks;

    return {
      id: p.id,
      jobNumber: p.jobNumber,
      name: p.name,
      division: p.division,
      clientName: p.clientName,
      generalContractor: p.generalContractor,
      location: p.location,
      projectType: p.projectType,
      divisions: projectDivisions(p.division, p.extraDivisions),
      projectManagerId: p.projectManagerId,
      divisionManagers: p.divisionManagers.map((dm) => ({
        id: dm.user.id,
        name: `${dm.user.firstName} ${dm.user.lastName}`.trim(),
        email: dm.user.email,
      })),
      tasks: groupFieldTasksByMaster(
        visibleTasks,
        userId,
        completedMap,
        progressMap,
        lineTypesByMaster,
        symbolTypesByMaster,
      ),
      route: p.route
        ? {
            label: p.route.label,
            startLat: p.route.startLat,
            startLng: p.route.startLng,
            startLabel: p.route.startLabel,
            endLat: p.route.endLat,
            endLng: p.route.endLng,
            endLabel: p.route.endLabel,
            beginSta: p.route.beginSta,
            endSta: p.route.endSta,
            polyline: (p.route.polyline as [number, number][] | null) ?? null,
            distanceMeters: p.route.distanceMeters,
          }
        : null,
    };
  });
}

/** Badge helper — recently assigned tasks for this field lead */
fieldProjectsRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tasks = await prisma.projectTask.findMany({
      where: {
        assignedToId: userId,
        isActive: true,
        createdAt: { gte: since },
        project: { status: "ACTIVE" },
      },
      select: { id: true, projectId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({
      newTaskCount: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  }),
);

/** Lightweight list for field project picker (no task aggregation). */
fieldProjectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const isFieldLead = req.user!.roles.includes("FIELD_LEAD");

    const projects = await prisma.project.findMany({
      where: {
        status: "ACTIVE",
        ...(isFieldLead ? fieldLeadAccessWhere(userId) : {}),
      },
      select: {
        id: true,
        jobNumber: true,
        name: true,
        division: true,
        clientName: true,
        generalContractor: true,
        location: true,
        route: {
          select: {
            beginSta: true,
            endSta: true,
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
        division: p.division,
        clientName: p.clientName,
        generalContractor: p.generalContractor,
        location: p.location,
        route: p.route
          ? {
              beginSta: p.route.beginSta,
              endSta: p.route.endSta,
            }
          : null,
      })),
    });
  }),
);

/** Full project detail with tasks, progress, and line/symbol types. */
fieldProjectsRouter.get(
  "/:projectId",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const isFieldLead = req.user!.roles.includes("FIELD_LEAD");
    const projectId = routeParam(req.params.projectId, "projectId");

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        status: "ACTIVE",
        ...(isFieldLead ? fieldLeadAccessWhere(userId) : {}),
      },
      include: fieldProjectInclude,
    });

    if (!project) {
      throw new AppError("NOT_FOUND", "Project not found", 404);
    }

    const [payload] = await buildFieldProjectPayload(
      [project],
      userId,
      isFieldLead,
    );
    res.json({ project: payload });
  }),
);
