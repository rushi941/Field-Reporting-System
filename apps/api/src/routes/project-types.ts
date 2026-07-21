import { Router } from "express";
import { prisma, type Division } from "@frs/db";
import {
  projectTypeSchema,
  updateProjectTypeSchema,
} from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const projectTypesRouter = Router();

projectTypesRouter.use(requireAuth, requirePermission("projects.manage"));

projectTypesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const activeOnly = req.query.active === "true";
    const types = await prisma.projectType.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { projects: true, tasks: true } } },
    });
    res.json({
      projectTypes: types.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        division: t.division,
        isActive: t.isActive,
        sortOrder: t.sortOrder,
        projectCount: t._count.projects,
        taskCount: t._count.tasks,
      })),
    });
  }),
);

projectTypesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = projectTypeSchema.parse(req.body);
    const code = body.code.toUpperCase();
    const exists = await prisma.projectType.findUnique({ where: { code } });
    if (exists) throw new AppError("CONFLICT", "Project type code already exists", 409);

    const row = await prisma.projectType.create({
      data: {
        code,
        name: body.name,
        description: body.description ?? null,
        division: (body.division as Division | null | undefined) ?? null,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    res.status(201).json({ projectType: row });
  }),
);

projectTypesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = updateProjectTypeSchema.parse(req.body);
    const id = routeParam(req.params.id);
    const existing = await prisma.projectType.findUnique({
      where: { id },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Project type not found", 404);

    if (body.code && body.code.toUpperCase() !== existing.code) {
      const clash = await prisma.projectType.findUnique({
        where: { code: body.code.toUpperCase() },
      });
      if (clash) throw new AppError("CONFLICT", "Project type code already exists", 409);
    }

    const row = await prisma.projectType.update({
      where: { id },
      data: {
        ...(body.code ? { code: body.code.toUpperCase() } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.division !== undefined
          ? { division: body.division as Division | null }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
    res.json({ projectType: row });
  }),
);

projectTypesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const existing = await prisma.projectType.findUnique({
      where: { id },
      include: { _count: { select: { projects: true, tasks: true } } },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Project type not found", 404);

    if (existing._count.projects > 0 || existing._count.tasks > 0) {
      throw new AppError(
        "CONFLICT",
        "Project type is linked to projects or bids. Deactivate it instead.",
        409,
      );
    }

    await prisma.projectType.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
