import { Router } from "express";
import {
  prisma,
  type Division,
  type ProjectStatus,
  type BidItemFormType,
  Prisma,
} from "@frs/db";
import {
  projectSchema,
  updateProjectSchema,
  projectCreateTaskSchema,
  projectTaskImportRowSchema,
  projectUpdateTaskLimitsSchema,
  projectDivisions,
  normalizeSta,
  physicalLfFromSta,
  type ProjectCreateTaskInput,
} from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth, requirePermission("projects.manage"));

const projectInclude = {
  projectType: { select: { id: true, code: true, name: true } },
  projectAdmin: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  projectManager: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  fieldLeads: {
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  divisionManagers: {
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  tasks: {
    include: {
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
          parentId: true,
          parent: { select: { id: true, code: true, name: true } },
          division: true,
          color: true,
          widthInches: true,
          conversionFactor: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  route: true,
  _count: { select: { bidItems: true, reports: true } },
} as const;

type ProjectLoaded = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

function mapRoute(route: ProjectLoaded["route"]) {
  if (!route) return null;
  return {
    id: route.id,
    label: route.label,
    startLat: route.startLat,
    startLng: route.startLng,
    startLabel: route.startLabel,
    endLat: route.endLat,
    endLng: route.endLng,
    endLabel: route.endLabel,
    beginSta: route.beginSta,
    endSta: route.endSta,
    polyline: (route.polyline as [number, number][] | null) ?? null,
    distanceMeters: route.distanceMeters,
  };
}

function mapUserBrief(u: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}) {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
  };
}

function mapProject(p: ProjectLoaded) {
  const configured = projectDivisions(p.division, p.extraDivisions);
  return {
    id: p.id,
    jobNumber: p.jobNumber,
    name: p.name,
    division: p.division,
    extraDivisions: p.extraDivisions,
    divisions: configured,
    projectTypeId: p.projectTypeId,
    projectType: p.projectType,
    projectAdminId: p.projectAdminId,
    projectAdmin: p.projectAdmin
      ? {
          id: p.projectAdmin.id,
          name: `${p.projectAdmin.firstName} ${p.projectAdmin.lastName}`,
          email: p.projectAdmin.email,
        }
      : null,
    projectManagerId: p.projectManagerId,
    projectManager: p.projectManager
      ? mapUserBrief(p.projectManager)
      : null,
    fieldLeadIds: p.fieldLeads.map((fl) => fl.userId),
    fieldLeads: p.fieldLeads.map((fl) => mapUserBrief(fl.user)),
    divisionManagerIds: p.divisionManagers.map((dm) => dm.userId),
    divisionManagers: p.divisionManagers.map((dm) => mapUserBrief(dm.user)),
    clientName: p.clientName,
    generalContractor: p.generalContractor,
    location: p.location,
    contractAmount: p.contractAmount ? Number(p.contractAmount) : null,
    startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
    endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : null,
    notes: p.notes,
    status: p.status,
    lastSyncedAt: p.lastSyncedAt,
    taskIds: p.tasks.map((t) => t.taskMasterId),
    tasks: p.tasks.map((t) => ({
      id: t.id,
      taskMasterId: t.taskMasterId,
      assignedToId: t.assignedToId,
      assignedTo: t.assignedTo
        ? {
            id: t.assignedTo.id,
            name: `${t.assignedTo.firstName} ${t.assignedTo.lastName}`,
            email: t.assignedTo.email,
          }
        : null,
      division: t.division,
      sortOrder: t.sortOrder,
      isActive: t.isActive,
      beginSta: t.beginSta,
      endSta: t.endSta,
      taskMaster: {
        ...t.taskMaster,
        conversionFactor:
          t.taskMaster.conversionFactor != null
            ? Number(t.taskMaster.conversionFactor)
            : null,
      },
    })),
    route: mapRoute(p.route),
    bidItemCount: p._count.bidItems,
    reportCount: p._count.reports,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid date", 400);
  }
  return d;
}

async function assertProjectAdmin(userId: string | null | undefined) {
  if (!userId) return;
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      roles: {
        some: {
          role: { in: ["PROJECT_ADMIN", "SYSTEM_ADMIN"] },
        },
      },
    },
  });
  if (!user) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Project admin must be an active project admin or system admin user",
      400,
    );
  }
}

async function assertDivisionManagers(userIds: string[]) {
  if (userIds.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Select at least one division manager",
      400,
    );
  }
  const unique = [...new Set(userIds)];
  const users = await prisma.user.findMany({
    where: {
      id: { in: unique },
      isActive: true,
      roles: { some: { role: "DIVISION_MANAGER" } },
    },
    select: { id: true },
  });
  if (users.length !== unique.length) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Each division manager must be an active division manager user",
      400,
    );
  }
}

async function assertFieldLeads(userIds: string[]) {
  if (userIds.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Select at least one field person",
      400,
    );
  }
  const unique = [...new Set(userIds)];
  const users = await prisma.user.findMany({
    where: {
      id: { in: unique },
      isActive: true,
      roles: { some: { role: "FIELD_LEAD" } },
    },
    select: { id: true },
  });
  if (users.length !== unique.length) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Each field person must be an active field lead",
      400,
    );
  }
}

async function syncProjectTeam(
  projectId: string,
  fieldLeadIds: string[],
  divisionManagerIds: string[],
) {
  const uniqueFieldLeads = [...new Set(fieldLeadIds)];
  const uniqueManagers = [...new Set(divisionManagerIds)];

  await prisma.$transaction([
    prisma.projectFieldLead.deleteMany({ where: { projectId } }),
    prisma.projectDivisionManager.deleteMany({ where: { projectId } }),
    ...(uniqueFieldLeads.length
      ? [
          prisma.projectFieldLead.createMany({
            data: uniqueFieldLeads.map((userId) => ({ projectId, userId })),
          }),
        ]
      : []),
    ...(uniqueManagers.length
      ? [
          prisma.projectDivisionManager.createMany({
            data: uniqueManagers.map((userId) => ({ projectId, userId })),
          }),
        ]
      : []),
    prisma.project.update({
      where: { id: projectId },
      data: { projectManagerId: uniqueManagers[0] ?? null },
    }),
  ]);
}

/** Validate job number uniqueness (no auto-allocation). */
async function resolveJobNumber(
  raw: string | null | undefined,
  excludeProjectId?: string,
): Promise<string> {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new AppError("VALIDATION_ERROR", "Job number is required", 400);
  }
  const jobNumber = trimmed.toUpperCase();
  const clash = await prisma.project.findFirst({
    where: {
      jobNumber,
      ...(excludeProjectId ? { NOT: { id: excludeProjectId } } : {}),
    },
  });
  if (clash) throw new AppError("CONFLICT", "Job number already exists", 409);
  return jobNumber;
}

async function assertFieldLead(
  userId: string | null | undefined,
  taskDivision?: Division,
) {
  if (!userId) {
    throw new AppError("VALIDATION_ERROR", "Field person is required", 400);
  }
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      roles: { some: { role: "FIELD_LEAD" } },
    },
    select: { id: true, division: true },
  });
  if (!user) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Field person must be an active field lead",
      400,
    );
  }
  if (taskDivision && user.division && user.division !== taskDivision) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Field person must belong to the task division",
      400,
    );
  }
}

function storedExtraDivisions(
  division: Division,
  divisions: Division[] | undefined,
): Division[] {
  return [...new Set((divisions ?? []).filter((d) => d !== division))];
}

/** Remove project and all dependent rows (reports, tasks, attachments, etc.) */
async function deleteProjectCascade(
  projectId: string,
  tx: Prisma.TransactionClient,
) {
  const reports = await tx.report.findMany({
    where: { projectId },
    select: { id: true },
  });
  const reportIds = reports.map((r) => r.id);

  if (reportIds.length > 0) {
    await tx.auditLog.deleteMany({
      where: { reportId: { in: reportIds } },
    });
    await tx.reportLineItem.deleteMany({
      where: { reportId: { in: reportIds } },
    });
    await tx.report.deleteMany({ where: { projectId } });
  }

  await tx.attachment.deleteMany({ where: { projectId } });
  await tx.projectRoute.deleteMany({ where: { projectId } });
  await tx.projectTask.deleteMany({ where: { projectId } });
  await tx.bidItem.deleteMany({ where: { projectId } });
  await tx.project.delete({ where: { id: projectId } });
}

async function syncProjectTasks(projectId: string, taskIds: string[]) {
  const unique = [...new Set(taskIds)];
  const masters = await prisma.taskMaster.findMany({
    where: { id: { in: unique }, isActive: true },
  });
  if (masters.length !== unique.length) {
    throw new AppError("VALIDATION_ERROR", "One or more tasks not found", 400);
  }
  for (const m of masters) {
    if (!m.division) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Task ${m.code} has no division — set division on the master task`,
        400,
      );
    }
  }

  const existing = await prisma.projectTask.findMany({
    where: { projectId },
    select: {
      id: true,
      taskMasterId: true,
      assignedToId: true,
      division: true,
    },
  });
  const keepByMaster = new Map(
    existing.map((t) => [
      t.taskMasterId,
      { assignedToId: t.assignedToId, division: t.division },
    ]),
  );
  const nextMasterIds = new Set(unique);
  const toRemove = existing.filter((t) => !nextMasterIds.has(t.taskMasterId));

  if (toRemove.length > 0) {
    await prisma.reportLineItem.deleteMany({
      where: { projectTaskId: { in: toRemove.map((t) => t.id) } },
    });
  }

  await prisma.projectTask.deleteMany({ where: { projectId } });
  if (masters.length === 0) return;

  await prisma.projectTask.createMany({
    data: masters.map((m, i) => {
      const kept = keepByMaster.get(m.id);
      return {
        projectId,
        taskMasterId: m.id,
        division: (kept?.division ?? m.division) as Division,
        assignedToId: kept?.assignedToId ?? null,
        sortOrder: i,
      };
    }),
  });
}

async function syncProjectRoute(
  projectId: string,
  route: {
    label?: string | null;
    startLat: number;
    startLng: number;
    startLabel?: string | null;
    endLat: number;
    endLng: number;
    endLabel?: string | null;
    beginSta?: string | null;
    endSta?: string | null;
    polyline?: [number, number][] | null;
    distanceMeters?: number | null;
  } | null | undefined,
) {
  if (route === undefined) return;
  if (route === null) {
    await prisma.projectRoute.deleteMany({ where: { projectId } });
    return;
  }
  let beginSta: string | null = null;
  let endSta: string | null = null;
  try {
    if (route.beginSta?.trim()) {
      beginSta = normalizeSta(route.beginSta);
    }
    if (route.endSta?.trim()) {
      endSta = normalizeSta(route.endSta);
    }
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      "Use valid station format for route begin/end STA (e.g. 100+00)",
      400,
    );
  }
  await prisma.projectRoute.upsert({
    where: { projectId },
    update: {
      label: route.label ?? null,
      startLat: route.startLat,
      startLng: route.startLng,
      startLabel: route.startLabel ?? null,
      endLat: route.endLat,
      endLng: route.endLng,
      endLabel: route.endLabel ?? null,
      beginSta,
      endSta,
      polyline: route.polyline ?? undefined,
      distanceMeters: route.distanceMeters ?? null,
    },
    create: {
      projectId,
      label: route.label ?? null,
      startLat: route.startLat,
      startLng: route.startLng,
      startLabel: route.startLabel ?? null,
      endLat: route.endLat,
      endLng: route.endLng,
      endLabel: route.endLabel ?? null,
      beginSta,
      endSta,
      polyline: route.polyline ?? undefined,
      distanceMeters: route.distanceMeters ?? null,
    },
  });
}

projectsRouter.get(
  "/activity-summary",
  requirePermission("projects.manage"),
  asyncHandler(async (_req, res) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const projects = await prisma.project.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      recentProjectCount: projects.length,
      projects: projects.map((p) => ({
        id: p.id,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  }),
);

projectsRouter.get(
  "/lookups",
  asyncHandler(async (_req, res) => {
    const [projectTypes, projectAdmins, divisionManagers, fieldLeads, taskRows, units] = await Promise.all([
      prisma.projectType.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, division: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          roles: { some: { role: "PROJECT_ADMIN" } },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          division: true,
          roles: { select: { role: true } },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          roles: { some: { role: "DIVISION_MANAGER" } },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          division: true,
          roles: { select: { role: true } },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          roles: { some: { role: "FIELD_LEAD" } },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          division: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.taskMaster.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          formType: true,
          division: true,
          parentId: true,
          sortOrder: true,
          color: true,
          widthInches: true,
          conversionFactor: true,
        },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      }),
      prisma.unitMaster.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      }),
    ]);

    const childrenByParent = new Map<string, typeof taskRows>();
    for (const t of taskRows) {
      if (!t.parentId) continue;
      const list = childrenByParent.get(t.parentId) ?? [];
      list.push(t);
      childrenByParent.set(t.parentId, list);
    }

    const taskTree = taskRows
      .filter((t) => !t.parentId)
      .map((parent) => ({
        ...parent,
        conversionFactor:
          parent.conversionFactor != null ? Number(parent.conversionFactor) : null,
        children: (childrenByParent.get(parent.id) ?? []).map((child) => ({
          ...child,
          conversionFactor:
            child.conversionFactor != null
              ? Number(child.conversionFactor)
              : null,
        })),
      }));

    const mapUser = (m: (typeof projectAdmins)[number]) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      email: m.email,
      division: m.division,
      roles: m.roles.map((r) => r.role),
    });

    res.json({
      projectTypes,
      projectAdmins: projectAdmins.map(mapUser),
      divisionManagers: divisionManagers.map(mapUser),
      /** @deprecated use projectAdmins / divisionManagers */
      managers: [...projectAdmins, ...divisionManagers].map(mapUser),
      fieldLeads: fieldLeads.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        division: u.division,
      })),
      taskTree,
      units,
    });
  }),
);

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const projects = await prisma.project.findMany({
      where: status ? { status: status as ProjectStatus } : undefined,
      include: projectInclude,
      orderBy: { jobNumber: "asc" },
    });

    res.json({ projects: projects.map(mapProject) });
  }),
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: projectInclude,
    });
    if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);
    res.json({ project: mapProject(project) });
  }),
);

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = projectSchema.parse(req.body);
    const jobNumber = await resolveJobNumber(body.jobNumber);

    if (body.projectTypeId) {
      const type = await prisma.projectType.findUnique({
        where: { id: body.projectTypeId },
      });
      if (!type) throw new AppError("NOT_FOUND", "Project type not found", 404);
    }

    await assertProjectAdmin(body.projectAdminId);
    await assertDivisionManagers(body.divisionManagerIds);
    await assertFieldLeads(body.fieldLeadIds);

    const project = await prisma.project.create({
      data: {
        jobNumber,
        name: body.name,
        division: body.division as Division,
        extraDivisions: storedExtraDivisions(
          body.division as Division,
          body.divisions as Division[] | undefined,
        ),
        projectTypeId: body.projectTypeId ?? null,
        projectAdminId: body.projectAdminId ?? null,
        projectManagerId: body.divisionManagerIds[0] ?? null,
        clientName: body.clientName ?? null,
        generalContractor: body.generalContractor ?? null,
        location: body.location ?? null,
        contractAmount: body.contractAmount ?? null,
        startDate: parseOptionalDate(body.startDate) ?? null,
        endDate: parseOptionalDate(body.endDate) ?? null,
        notes: body.notes ?? null,
        status: (body.status as ProjectStatus) ?? "ACTIVE",
      },
    });

    await syncProjectTeam(project.id, body.fieldLeadIds, body.divisionManagerIds);
    await syncProjectTasks(project.id, body.taskIds ?? []);
    await syncProjectRoute(project.id, body.route);

    const full = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: projectInclude,
    });
    res.status(201).json({ project: mapProject(full) });
  }),
);

async function addProjectTaskInternal(
  projectId: string,
  body: ProjectCreateTaskInput,
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

  const allowedDivisions = projectDivisions(
    project.division,
    project.extraDivisions,
  );
  const taskDivision = (body.division ?? project.division) as Division;
  if (!allowedDivisions.includes(taskDivision)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Task division must be on the project",
      400,
    );
  }

  await assertFieldLead(body.assignedToId, taskDivision);

  const code = (body.code ?? body.name).trim().toUpperCase().replace(/\s+/g, "-");
  if (!code) {
    throw new AppError("VALIDATION_ERROR", "Task code is required", 400);
  }

  let master = await prisma.taskMaster.findUnique({ where: { code } });
  if (!master) {
    master = await prisma.taskMaster.create({
      data: {
        code,
        name: body.name,
        unit: body.unit ?? "LF",
        formType: (body.formType as BidItemFormType) ?? "STA_RANGE",
        division: taskDivision,
        color: body.color ?? null,
        widthInches: body.widthInches ?? null,
        conversionFactor: body.conversionFactor,
        description: body.description ?? null,
        projectTypeId: project.projectTypeId,
        isActive: true,
        sortOrder: 0,
      },
    });
  }

  const existing = await prisma.projectTask.findUnique({
    where: {
      projectId_taskMasterId: {
        projectId,
        taskMasterId: master.id,
      },
    },
  });
  if (existing) {
    throw new AppError(
      "CONFLICT",
      "This task is already on the project",
      409,
    );
  }

  const count = await prisma.projectTask.count({ where: { projectId } });

  let beginSta: string | null = null;
  let endSta: string | null = null;
  if (body.formType === "STA_RANGE" || body.beginSta || body.endSta) {
    try {
      if (body.beginSta?.trim()) beginSta = normalizeSta(body.beginSta);
      if (body.endSta?.trim()) endSta = normalizeSta(body.endSta);
      if (beginSta && endSta) {
        physicalLfFromSta(beginSta, endSta);
      }
    } catch (err) {
      throw new AppError(
        "VALIDATION_ERROR",
        err instanceof Error ? err.message : "Invalid begin/end STA",
        400,
      );
    }
  }

  await prisma.projectTask.create({
    data: {
      projectId,
      taskMasterId: master.id,
      assignedToId: body.assignedToId,
      division: taskDivision,
      sortOrder: count,
      beginSta,
      endSta,
    },
  });

  if (project.projectManagerId) {
    const assignee = await prisma.user.findUnique({
      where: { id: body.assignedToId },
      select: { division: true },
    });
    if (assignee) {
      await prisma.user.update({
        where: { id: body.assignedToId },
        data: {
          managerId: project.projectManagerId,
          division: assignee.division ?? taskDivision,
        },
      });
    }
  }
}

function zImportRows(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new AppError("VALIDATION_ERROR", "Body must include rows: []", 400);
  }
  return value;
}

/** Create a work task (line code + CF) and attach it to the project */
projectsRouter.post(
  "/:id/tasks",
  asyncHandler(async (req, res) => {
    const projectId = routeParam(req.params.id);
    const body = projectCreateTaskSchema.parse(req.body);
    await addProjectTaskInternal(projectId, body);

    const full = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: projectInclude,
    });
    res.status(201).json({ project: mapProject(full) });
  }),
);

/** Bulk import project tasks from CSV / Excel rows */
projectsRouter.post(
  "/:id/tasks/import",
  asyncHandler(async (req, res) => {
    const projectId = routeParam(req.params.id);
    const rows = zImportRows(req.body?.rows);

    let created = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = projectTaskImportRowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        errors.push({
          row: i + 1,
          message: parsed.error.issues[0]?.message ?? "Invalid row",
        });
        continue;
      }
      const row = parsed.data;

      const user = await prisma.user.findFirst({
        where: {
          email: { equals: row.fieldPersonEmail, mode: "insensitive" },
          isActive: true,
          roles: { some: { role: "FIELD_LEAD" } },
        },
        select: { id: true },
      });
      if (!user) {
        errors.push({
          row: i + 1,
          message: `Unknown field person email: ${row.fieldPersonEmail}`,
        });
        continue;
      }

      try {
        await addProjectTaskInternal(projectId, {
          code: row.code,
          name: row.name,
          unit: row.unit,
          formType: row.formType,
          division: row.division,
          color: row.color,
          widthInches: row.widthInches,
          conversionFactor: row.conversionFactor,
          description: row.description,
          assignedToId: user.id,
          beginSta: row.beginSta,
          endSta: row.endSta,
        });
        created += 1;
      } catch (err) {
        errors.push({
          row: i + 1,
          message:
            err instanceof AppError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Import failed",
        });
      }
    }

    const full = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: projectInclude,
    });
    res.json({
      created,
      errorCount: errors.length,
      errors,
      project: mapProject(full),
    });
  }),
);

/** Set begin/end STA work limits on an existing project task */
projectsRouter.patch(
  "/:projectId/tasks/:taskId/limits",
  asyncHandler(async (req, res) => {
    const projectId = routeParam(req.params.projectId);
    const taskId = routeParam(req.params.taskId);
    const body = projectUpdateTaskLimitsSchema.parse(req.body);

    const task = await prisma.projectTask.findFirst({
      where: { id: taskId, projectId, isActive: true },
      include: { taskMaster: { select: { formType: true } } },
    });
    if (!task) {
      throw new AppError("NOT_FOUND", "Task not found", 404);
    }
    if (task.taskMaster.formType !== "STA_RANGE") {
      throw new AppError(
        "VALIDATION_ERROR",
        "STA limits apply only to STA range tasks",
        400,
      );
    }

    const beginSta = normalizeSta(body.beginSta);
    const endSta = normalizeSta(body.endSta);
    physicalLfFromSta(beginSta, endSta);

    await prisma.projectTask.update({
      where: { id: taskId },
      data: { beginSta, endSta },
    });

    const full = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: projectInclude,
    });
    res.json({ project: mapProject(full) });
  }),
);

projectsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = updateProjectSchema.parse(req.body);
    const id = routeParam(req.params.id);
    const existing = await prisma.project.findUnique({
      where: { id },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Project not found", 404);

    let resolvedJobNumber: string | undefined;
    if (body.jobNumber !== undefined) {
      resolvedJobNumber = await resolveJobNumber(body.jobNumber, id);
    }

    if (body.projectTypeId) {
      const type = await prisma.projectType.findUnique({
        where: { id: body.projectTypeId },
      });
      if (!type) throw new AppError("NOT_FOUND", "Project type not found", 404);
    }

    if (body.projectAdminId !== undefined) {
      await assertProjectAdmin(body.projectAdminId);
    }

    if (body.divisionManagerIds !== undefined) {
      await assertDivisionManagers(body.divisionManagerIds);
    }

    if (body.fieldLeadIds !== undefined) {
      await assertFieldLeads(body.fieldLeadIds);
    }

    const nextDivision = (body.division ?? existing.division) as Division;
    const nextExtras =
      body.divisions !== undefined || body.division !== undefined
        ? storedExtraDivisions(
            nextDivision,
            (body.divisions ?? existing.extraDivisions) as Division[],
          )
        : undefined;

    await prisma.project.update({
      where: { id },
      data: {
        ...(resolvedJobNumber !== undefined
          ? { jobNumber: resolvedJobNumber }
          : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.division !== undefined
          ? { division: body.division as Division }
          : {}),
        ...(nextExtras !== undefined ? { extraDivisions: nextExtras } : {}),
        ...(body.projectTypeId !== undefined
          ? { projectTypeId: body.projectTypeId }
          : {}),
        ...(body.projectAdminId !== undefined
          ? { projectAdminId: body.projectAdminId }
          : {}),
        ...(body.divisionManagerIds !== undefined
          ? { projectManagerId: body.divisionManagerIds[0] ?? null }
          : body.projectManagerId !== undefined
            ? { projectManagerId: body.projectManagerId }
            : {}),
        ...(body.clientName !== undefined ? { clientName: body.clientName } : {}),
        ...(body.generalContractor !== undefined
          ? { generalContractor: body.generalContractor }
          : {}),
        ...(body.location !== undefined ? { location: body.location } : {}),
        ...(body.contractAmount !== undefined
          ? { contractAmount: body.contractAmount }
          : {}),
        ...(body.startDate !== undefined
          ? { startDate: parseOptionalDate(body.startDate) ?? null }
          : {}),
        ...(body.endDate !== undefined
          ? { endDate: parseOptionalDate(body.endDate) ?? null }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.status !== undefined
          ? { status: body.status as ProjectStatus }
          : {}),
      },
    });

    if (
      body.fieldLeadIds !== undefined ||
      body.divisionManagerIds !== undefined
    ) {
      const current = await prisma.project.findUniqueOrThrow({
        where: { id },
        include: {
          fieldLeads: { select: { userId: true } },
          divisionManagers: { select: { userId: true } },
        },
      });
      await syncProjectTeam(
        id,
        body.fieldLeadIds ??
          current.fieldLeads.map((fl) => fl.userId),
        body.divisionManagerIds ??
          current.divisionManagers.map((dm) => dm.userId),
      );
    }

    if (body.taskIds !== undefined) {
      await syncProjectTasks(id, body.taskIds);
    }
    if (body.route !== undefined) {
      await syncProjectRoute(id, body.route);
    }

    const full = await prisma.project.findUniqueOrThrow({
      where: { id },
      include: projectInclude,
    });
    res.json({ project: mapProject(full) });
  }),
);

projectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Project not found", 404);

    await prisma.$transaction((tx) => deleteProjectCascade(id, tx));

    res.json({ ok: true });
  }),
);
