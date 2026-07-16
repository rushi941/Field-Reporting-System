import { Router } from "express";
import { prisma } from "@frs/db";
import { unitMasterSchema, updateUnitMasterSchema } from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const unitsRouter = Router();

unitsRouter.use(requireAuth, requirePermission("projects.manage"));

unitsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const activeOnly = req.query.active === "true";
    const units = await prisma.unitMaster.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    res.json({ units });
  }),
);

unitsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = unitMasterSchema.parse(req.body);
    const code = body.code.toUpperCase();
    const exists = await prisma.unitMaster.findUnique({ where: { code } });
    if (exists) throw new AppError("CONFLICT", "Unit code already exists", 409);

    const row = await prisma.unitMaster.create({
      data: {
        code,
        name: body.name,
        description: body.description ?? null,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    res.status(201).json({ unit: row });
  }),
);

unitsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = updateUnitMasterSchema.parse(req.body);
    const id = routeParam(req.params.id);
    const existing = await prisma.unitMaster.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Unit not found", 404);

    if (body.code && body.code.toUpperCase() !== existing.code) {
      const clash = await prisma.unitMaster.findUnique({
        where: { code: body.code.toUpperCase() },
      });
      if (clash) throw new AppError("CONFLICT", "Unit code already exists", 409);
    }

    const row = await prisma.unitMaster.update({
      where: { id },
      data: {
        ...(body.code ? { code: body.code.toUpperCase() } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
    res.json({ unit: row });
  }),
);
