import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma, type Division, type Role } from "@frs/db";
import { createUserSchema, updateUserSchema } from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const usersRouter = Router();

function mapUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  division: Division | null;
  managerId: string | null;
  crewId: string | null;
  createdAt: Date;
  updatedAt: Date;
  roles: { role: Role }[];
  manager?: { id: string; firstName: string; lastName: string; email: string } | null;
  crew?: { id: string; name: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    isActive: user.isActive,
    division: user.division,
    managerId: user.managerId,
    crewId: user.crewId,
    roles: user.roles.map((r) => r.role),
    manager: user.manager
      ? {
          id: user.manager.id,
          name: `${user.manager.firstName} ${user.manager.lastName}`,
          email: user.manager.email,
        }
      : null,
    crew: user.crew ? { id: user.crew.id, name: user.crew.name } : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

const userInclude = {
  roles: true,
  manager: { select: { id: true, firstName: true, lastName: true, email: true } },
  crew: { select: { id: true, name: true } },
} as const;

usersRouter.use(requireAuth, requirePermission("users.manage"));

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      include: userInclude,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    res.json({ users: users.map(mapUser) });
  }),
);

usersRouter.get(
  "/managers",
  asyncHandler(async (_req, res) => {
    const managers = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: { some: { role: { in: ["DIVISION_MANAGER", "SYSTEM_ADMIN"] } } },
      },
      select: { id: true, firstName: true, lastName: true, email: true, division: true },
      orderBy: { lastName: "asc" },
    });
    res.json({
      managers: managers.map((m) => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
        email: m.email,
        division: m.division,
      })),
    });
  }),
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: userInclude,
    });
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
    res.json({ user: mapUser(user) });
  }),
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("CONFLICT", "Email already in use", 409);
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone ?? null,
        isActive: body.isActive ?? true,
        division: body.division ?? null,
        managerId: body.managerId ?? null,
        crewId: body.crewId ?? null,
        roles: {
          create: body.roles.map((role) => ({ role: role as Role })),
        },
      },
      include: userInclude,
    });

    res.status(201).json({ user: mapUser(user) });
  }),
);

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = updateUserSchema.parse(req.body);
    const id = req.params.id;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "User not found", 404);

    if (body.email) {
      const email = body.email.toLowerCase();
      const clash = await prisma.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (clash) throw new AppError("CONFLICT", "Email already in use", 409);
    }

    const passwordHash =
      body.password && body.password.length > 0
        ? await bcrypt.hash(body.password, 10)
        : undefined;

    const user = await prisma.$transaction(async (tx) => {
      if (body.roles) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: body.roles.map((role) => ({ userId: id, role: role as Role })),
        });
      }

      return tx.user.update({
        where: { id },
        data: {
          ...(body.email ? { email: body.email.toLowerCase() } : {}),
          ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
          ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.division !== undefined ? { division: body.division } : {}),
          ...(body.managerId !== undefined ? { managerId: body.managerId } : {}),
          ...(body.crewId !== undefined ? { crewId: body.crewId } : {}),
          ...(passwordHash ? { passwordHash } : {}),
        },
        include: userInclude,
      });
    });

    res.json({ user: mapUser(user) });
  }),
);

usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    if (req.user?.id === id) {
      throw new AppError("BAD_REQUEST", "You cannot delete your own account", 400);
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            reportsSubmitted: true,
            reportsApproved: true,
            projectsManaged: true,
            projectTasksAssigned: true,
            directReports: true,
            crewsManaged: true,
            attachments: true,
            auditLogs: true,
            importRuns: true,
          },
        },
      },
    });
    if (!existing) throw new AppError("NOT_FOUND", "User not found", 404);

    const inUse =
      existing._count.reportsSubmitted > 0 ||
      existing._count.reportsApproved > 0 ||
      existing._count.projectsManaged > 0 ||
      existing._count.projectTasksAssigned > 0 ||
      existing._count.directReports > 0 ||
      existing._count.crewsManaged > 0 ||
      existing._count.attachments > 0 ||
      existing._count.auditLogs > 0 ||
      existing._count.importRuns > 0;

    if (inUse) {
      const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        include: userInclude,
      });
      res.json({
        user: mapUser(user),
        mode: "deactivated" as const,
        message:
          "User has history on reports or projects and was deactivated instead of removed.",
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { managerId: id },
        data: { managerId: null },
      });
      await tx.crew.updateMany({
        where: { managerId: id },
        data: { managerId: null },
      });
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    res.json({ ok: true, mode: "deleted" as const });
  }),
);
