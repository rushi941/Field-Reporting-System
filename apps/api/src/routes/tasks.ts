import { Router } from "express";
import {
  prisma,
  type BidItemFormType,
  type Division,
} from "@frs/db";
import {
  taskImportRowSchema,
  taskMasterSchema,
  updateTaskMasterSchema,
} from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth, requirePermission("projects.manage"));

tasksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectTypeId =
      typeof req.query.projectTypeId === "string"
        ? req.query.projectTypeId
        : undefined;
    const activeOnly = req.query.active === "true";

    const tasks = await prisma.taskMaster.findMany({
      where: {
        ...(projectTypeId ? { projectTypeId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        projectType: { select: { id: true, code: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
        children: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            division: true,
            color: true,
            widthInches: true,
            conversionFactor: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { children: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });

    res.json({
      tasks: tasks.map((t) => ({
        ...t,
        conversionFactor:
          t.conversionFactor != null ? Number(t.conversionFactor) : null,
        children: t.children.map((c) => ({
          ...c,
          conversionFactor:
            c.conversionFactor != null ? Number(c.conversionFactor) : null,
        })),
      })),
    });
  }),
);

tasksRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = taskMasterSchema.parse(req.body);
    const code = body.code.toUpperCase();
    const exists = await prisma.taskMaster.findUnique({ where: { code } });
    if (exists) throw new AppError("CONFLICT", "Task code already exists", 409);

    const task = await prisma.taskMaster.create({
      data: {
        code,
        name: body.name,
        description: body.description ?? null,
        unit: body.unit,
        formType: (body.formType as BidItemFormType) ?? "STA_RANGE",
        projectTypeId: body.projectTypeId ?? null,
        parentId: body.parentId ?? null,
        division: (body.division as Division | null | undefined) ?? null,
        color: body.color ?? null,
        widthInches: body.widthInches ?? null,
        conversionFactor: body.conversionFactor ?? null,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
      include: {
        projectType: { select: { id: true, code: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
        children: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            division: true,
            color: true,
            widthInches: true,
            conversionFactor: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    res.status(201).json({
      task: {
        ...task,
        conversionFactor:
          task.conversionFactor != null ? Number(task.conversionFactor) : null,
      },
    });
  }),
);

tasksRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = updateTaskMasterSchema.parse(req.body);
    const id = routeParam(req.params.id);
    const existing = await prisma.taskMaster.findUnique({
      where: { id },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Task not found", 404);

    if (body.code && body.code.toUpperCase() !== existing.code) {
      const clash = await prisma.taskMaster.findUnique({
        where: { code: body.code.toUpperCase() },
      });
      if (clash) throw new AppError("CONFLICT", "Task code already exists", 409);
    }

    const task = await prisma.taskMaster.update({
      where: { id },
      data: {
        ...(body.code ? { code: body.code.toUpperCase() } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
        ...(body.formType !== undefined
          ? { formType: body.formType as BidItemFormType }
          : {}),
        ...(body.projectTypeId !== undefined
          ? { projectTypeId: body.projectTypeId }
          : {}),
        ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        ...(body.division !== undefined
          ? { division: body.division as Division | null }
          : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.widthInches !== undefined
          ? { widthInches: body.widthInches }
          : {}),
        ...(body.conversionFactor !== undefined
          ? { conversionFactor: body.conversionFactor }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
      include: {
        projectType: { select: { id: true, code: true, name: true } },
        parent: { select: { id: true, code: true, name: true } },
        children: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            division: true,
            color: true,
            widthInches: true,
            conversionFactor: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    res.json({
      task: {
        ...task,
        conversionFactor:
          task.conversionFactor != null ? Number(task.conversionFactor) : null,
      },
    });
  }),
);

/** CSV/JSON import for task master rows */
tasksRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const rows = zArray(req.body?.rows);
    const types = await prisma.projectType.findMany();
    const byCode = Object.fromEntries(types.map((t) => [t.code.toUpperCase(), t.id]));

    let upserted = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = taskImportRowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid" });
        continue;
      }
      const row = parsed.data;
      const code = row.code.toUpperCase();
      const projectTypeId = row.projectTypeCode
        ? byCode[row.projectTypeCode.toUpperCase()] ?? null
        : null;
      if (row.projectTypeCode && !projectTypeId) {
        errors.push({
          row: i + 1,
          message: `Unknown project type code: ${row.projectTypeCode}`,
        });
        continue;
      }

      let parentId: string | null = null;
      if (row.parentCode) {
        const parent = await prisma.taskMaster.findUnique({
          where: { code: row.parentCode.toUpperCase() },
        });
        if (!parent) {
          errors.push({
            row: i + 1,
            message: `Unknown parent task code: ${row.parentCode}`,
          });
          continue;
        }
        parentId = parent.id;
      }

      await prisma.taskMaster.upsert({
        where: { code },
        update: {
          name: row.name,
          unit: row.unit,
          formType: row.formType as BidItemFormType,
          projectTypeId,
          parentId,
          division: (row.division as Division | null | undefined) ?? null,
          description: row.description ?? null,
          isActive: true,
        },
        create: {
          code,
          name: row.name,
          unit: row.unit,
          formType: (row.formType as BidItemFormType) ?? "STA_RANGE",
          projectTypeId,
          parentId,
          division: (row.division as Division | null | undefined) ?? null,
          description: row.description ?? null,
        },
      });
      upserted += 1;
    }

    res.json({ upserted, errorCount: errors.length, errors });
  }),
);

function zArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new AppError("VALIDATION_ERROR", "Body must include rows: []", 400);
  }
  return value;
}
