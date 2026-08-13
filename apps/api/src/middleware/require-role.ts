import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error.js";

export function requireRole(...allowed: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError("UNAUTHORIZED", "Authentication required", 401);
      }
      if (!req.user.roles.some((role) => allowed.includes(role))) {
        throw new AppError(
          "FORBIDDEN",
          "You do not have access to this workspace",
          403,
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
