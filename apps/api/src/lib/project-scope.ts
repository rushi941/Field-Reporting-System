import type { Prisma } from "@frs/db";
import { AppError } from "./app-error.js";

/** System admin sees all jobs; project admin sees only jobs they own. */
export function projectManageScopeWhere(
  userId: string,
  roles: string[],
): Prisma.ProjectWhereInput {
  if (roles.includes("SYSTEM_ADMIN")) return {};
  return { projectAdminId: userId };
}

export function assertCanManageProject(
  projectAdminId: string | null,
  userId: string,
  roles: string[],
) {
  if (roles.includes("SYSTEM_ADMIN")) return;
  if (projectAdminId === userId) return;
  throw new AppError(
    "FORBIDDEN",
    "You can only access projects assigned to you",
    403,
  );
}
