import { Router } from "express";
import { prisma } from "@frs/db";
import { projectDivisions } from "@frs/shared";
import { asyncHandler } from "../lib/async-handler.js";
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

/** Active jobs with assigned tasks + pinned route for field crews */
fieldProjectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const isFieldLead = req.user!.roles.includes("FIELD_LEAD");

    const projects = await prisma.project.findMany({
      where: {
        status: "ACTIVE",
        ...(isFieldLead
          ? {
              OR: [
                {
                  fieldLeads: { some: { userId } },
                },
                {
                  tasks: {
                    some: {
                      isActive: true,
                      assignedToId: userId,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
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
          orderBy: { sortOrder: "asc" },
        },
        projectType: { select: { code: true, name: true } },
      },
      orderBy: { jobNumber: "asc" },
    });

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
      taskMaster: { formType: string; conversionFactor: number | null };
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

    res.json({
      projects: projects.map((p) => {
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
      }),
    });
  }),
);
