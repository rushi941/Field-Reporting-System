import { Router } from "express";
import { prisma } from "@frs/db";
import { projectDivisions } from "@frs/shared";
import { asyncHandler } from "../lib/async-handler.js";
import { fetchCompletedStaRanges } from "../lib/sta-coverage.js";
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
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        projectType: { select: { code: true, name: true } },
      },
      orderBy: { jobNumber: "asc" },
    });

    const taskIds = projects.flatMap((p) => p.tasks.map((t) => t.id));
    const completedMap = await fetchCompletedStaRanges(taskIds);

    res.json({
      projects: projects.map((p) => ({
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
        tasks: p.tasks.map((t) => ({
          id: t.id,
          division: t.division,
          assignedToId: t.assignedToId,
          assignedTo: t.assignedTo
            ? {
                id: t.assignedTo.id,
                name: `${t.assignedTo.firstName} ${t.assignedTo.lastName}`.trim(),
                email: t.assignedTo.email,
              }
            : null,
          isMine: t.assignedToId === userId,
          beginSta: t.beginSta,
          endSta: t.endSta,
          completedStaRanges: completedMap.get(t.id) ?? [],
          taskMaster: {
            ...t.taskMaster,
            conversionFactor:
              t.taskMaster.conversionFactor != null
                ? Number(t.taskMaster.conversionFactor)
                : null,
          },
        })),
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
      })),
    });
  }),
);
