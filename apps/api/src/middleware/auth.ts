import type { NextFunction, Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { AppError } from "../lib/app-error.js";

export type AuthUser = {
  id: string;
  email: string;
  roles: string[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

type JwtPayload = {
  sub: string;
  email: string;
  roles: string[];
};

export function signToken(user: AuthUser): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  const options: SignOptions = {
    subject: user.id,
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "8h") as SignOptions["expiresIn"],
  };

  return jwt.sign({ email: user.email, roles: user.roles }, secret, options);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");

    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, secret) as JwtPayload;

    req.user = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
    };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError("UNAUTHORIZED", "Invalid or expired token", 401));
  }
}
