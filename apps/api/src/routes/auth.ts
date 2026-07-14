import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "@frs/db";
import { loginSchema } from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { asyncHandler } from "../lib/async-handler.js";
import { getEffectivePermissions } from "../services/permissions.js";

export const authRouter = Router();

function toPublicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: { role: string }[];
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles.map((r) => r.role),
  };
}

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: { roles: true },
    });

    if (!user || !user.isActive) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    if (user.roles.length === 0) {
      throw new AppError(
        "FORBIDDEN",
        "No role assigned. Contact your system administrator.",
        403,
      );
    }

    const match = await bcrypt.compare(body.password, user.passwordHash);
    if (!match) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    const publicUser = toPublicUser(user);
    const permissions = await getEffectivePermissions(publicUser.roles);
    const token = signToken({
      id: publicUser.id,
      email: publicUser.email,
      roles: publicUser.roles,
    });

    res.json({
      token,
      user: { ...publicUser, permissions },
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { roles: true },
    });

    if (!user || !user.isActive) {
      throw new AppError("UNAUTHORIZED", "User not found or inactive", 401);
    }

    const publicUser = toPublicUser(user);
    const permissions = await getEffectivePermissions(publicUser.roles);
    res.json({ user: { ...publicUser, permissions } });
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ ok: true });
  }),
);
