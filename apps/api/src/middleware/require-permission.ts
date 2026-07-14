import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { userHasPermission } from "../services/permissions.js";
import type { PermissionKey } from "@frs/shared";

export function requirePermission(key: PermissionKey | string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError("UNAUTHORIZED", "Authentication required", 401);
      }
      const ok = await userHasPermission(req.user.roles, key);
      if (!ok) {
        throw new AppError("FORBIDDEN", "You do not have permission for this action", 403);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
