import { Router } from "express";
import { prisma } from "@frs/db";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const crewsRouter = Router();

crewsRouter.get(
  "/",
  requireAuth,
  requirePermission("users.manage"),
  asyncHandler(async (_req, res) => {
    const crews = await prisma.crew.findMany({
      where: { isActive: true },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      crews: crews.map((c) => ({
        id: c.id,
        name: c.name,
        division: c.division,
        managerId: c.managerId,
        managerName: c.manager
          ? `${c.manager.firstName} ${c.manager.lastName}`
          : null,
        memberCount: c._count.members,
      })),
    });
  }),
);
