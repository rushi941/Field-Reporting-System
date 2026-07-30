import { Router } from "express";
import { prisma } from "@frs/db";
import {
  clientImportRowSchema,
  clientMasterSchema,
  updateClientMasterSchema,
} from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const clientsRouter = Router();

clientsRouter.use(requireAuth, requirePermission("projects.manage"));

clientsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const activeOnly = req.query.active === "true";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const all = req.query.all === "true";
    const page = Math.max(1, Number(req.query.page) || 1);
    const sortByRaw = typeof req.query.sortBy === "string" ? req.query.sortBy : "";
    const sortDir = req.query.sortDir === "desc" ? "desc" : "asc";
    const pageSize = all
      ? undefined
      : Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

    const where = {
      ...(activeOnly ? { isActive: true } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const orderBy =
      sortByRaw === "name"
        ? [{ name: sortDir as "asc" | "desc" }]
        : sortByRaw === "foundationNumber"
          ? [
              { foundationNumber: sortDir as "asc" | "desc" },
              { name: "asc" as const },
            ]
          : sortByRaw === "status"
            ? [{ isActive: sortDir as "asc" | "desc" }, { name: "asc" as const }]
            : [{ sortOrder: "asc" as const }, { name: "asc" as const }];

    const [total, clients] = await Promise.all([
      prisma.clientMaster.count({ where }),
      prisma.clientMaster.findMany({
        where,
        orderBy,
        ...(pageSize != null
          ? { skip: (page - 1) * pageSize, take: pageSize }
          : {}),
      }),
    ]);

    res.json({
      clients,
      total,
      page: pageSize != null ? page : 1,
      pageSize: pageSize ?? total,
      totalPages: pageSize != null ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    });
  }),
);

clientsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = clientMasterSchema.parse(req.body);
    const name = body.name.trim();
    const exists = await prisma.clientMaster.findUnique({ where: { name } });
    if (exists) throw new AppError("CONFLICT", "Client name already exists", 409);

    const row = await prisma.clientMaster.create({
      data: {
        name,
        foundationNumber: body.foundationNumber ?? null,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? body.foundationNumber ?? 0,
      },
    });
    res.status(201).json({ client: row });
  }),
);

clientsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = updateClientMasterSchema.parse(req.body);
    const id = routeParam(req.params.id);
    const existing = await prisma.clientMaster.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Client not found", 404);

    if (body.name && body.name.trim() !== existing.name) {
      const clash = await prisma.clientMaster.findUnique({
        where: { name: body.name.trim() },
      });
      if (clash) throw new AppError("CONFLICT", "Client name already exists", 409);
    }

    const row = await prisma.clientMaster.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.foundationNumber !== undefined
          ? { foundationNumber: body.foundationNumber }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
    res.json({ client: row });
  }),
);

clientsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const existing = await prisma.clientMaster.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Client not found", 404);

    const inUse = await prisma.project.findFirst({
      where: {
        OR: [
          { clientName: existing.name },
          { generalContractor: existing.name },
        ],
      },
      select: { id: true, jobNumber: true },
    });
    if (inUse) {
      throw new AppError(
        "CONFLICT",
        `Client "${existing.name}" is used on project ${inUse.jobNumber}. Deactivate it instead.`,
        409,
      );
    }

    await prisma.clientMaster.delete({ where: { id } });
    res.json({ ok: true });
  }),
);

clientsRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const rows = zArray(req.body?.rows);
    let upserted = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = clientImportRowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        errors.push({
          row: i + 1,
          message: parsed.error.issues[0]?.message ?? "Invalid row",
        });
        continue;
      }
      const row = parsed.data;
      const name = row.name.trim();
      if (!name) {
        errors.push({ row: i + 1, message: "Name is required" });
        continue;
      }

      await prisma.clientMaster.upsert({
        where: { name },
        update: {
          foundationNumber: row.foundationNumber ?? undefined,
          sortOrder: row.foundationNumber ?? undefined,
          isActive: true,
        },
        create: {
          name,
          foundationNumber: row.foundationNumber ?? null,
          sortOrder: row.foundationNumber ?? 0,
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
