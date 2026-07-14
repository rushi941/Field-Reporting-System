import { Router } from "express";
import { prisma, type PermissionAccess, type Role } from "@frs/db";
import { updatePermissionMatrixSchema } from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";
import { getPermissionMatrix } from "../services/permissions.js";

export const permissionsRouter = Router();

permissionsRouter.get(
  "/matrix",
  requireAuth,
  requirePermission("permissions.manage"),
  asyncHandler(async (_req, res) => {
    const matrix = await getPermissionMatrix();
    res.json({ matrix });
  }),
);

permissionsRouter.put(
  "/matrix",
  requireAuth,
  requirePermission("permissions.manage"),
  asyncHandler(async (req, res) => {
    const body = updatePermissionMatrixSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      for (const cell of body.cells) {
        const permission = await tx.permission.findUnique({
          where: { key: cell.permissionKey },
        });
        if (!permission) {
          throw new AppError(
            "NOT_FOUND",
            `Unknown permission: ${cell.permissionKey}`,
            404,
          );
        }

        await tx.rolePermission.upsert({
          where: {
            role_permissionId: {
              role: cell.role as Role,
              permissionId: permission.id,
            },
          },
          update: { access: cell.access as PermissionAccess },
          create: {
            role: cell.role as Role,
            permissionId: permission.id,
            access: cell.access as PermissionAccess,
          },
        });
      }
    });

    const matrix = await getPermissionMatrix();
    res.json({ matrix });
  }),
);
