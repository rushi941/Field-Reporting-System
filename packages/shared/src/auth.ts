import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const roles = [
  "FIELD_LEAD",
  "DIVISION_MANAGER",
  "PROJECT_ADMIN",
  "SYSTEM_ADMIN",
] as const;

export type AppRole = (typeof roles)[number];

export const roleLabels: Record<AppRole, string> = {
  FIELD_LEAD: "Field Lead",
  DIVISION_MANAGER: "Division Manager / Senior Supervisor",
  PROJECT_ADMIN: "Project Admin",
  SYSTEM_ADMIN: "System Admin",
};

/** FRD §5.1 user type responsibilities (docs / admin — not login chrome) */
export const roleDescriptions: Record<AppRole, string> = {
  FIELD_LEAD:
    "Field user responsible for submitting daily reports from job sites",
  DIVISION_MANAGER:
    "Approver responsible for reviewing reports from assigned crews/divisions",
  PROJECT_ADMIN:
    "Office user responsible for reviewing approved reports and preparing billing backup",
  SYSTEM_ADMIN:
    "Administrative user responsible for managing users, roles, projects, imports, and settings",
};

/** Higher index = higher priority when a user has multiple roles */
const rolePriority: AppRole[] = [
  "FIELD_LEAD",
  "DIVISION_MANAGER",
  "PROJECT_ADMIN",
  "SYSTEM_ADMIN",
];

export function isAppRole(role: string): role is AppRole {
  return (roles as readonly string[]).includes(role);
}

export function getPrimaryRole(userRoles: string[]): AppRole | null {
  let best: AppRole | null = null;
  let bestScore = -1;
  for (const role of userRoles) {
    if (!isAppRole(role)) continue;
    const score = rolePriority.indexOf(role);
    if (score > bestScore) {
      bestScore = score;
      best = role;
    }
  }
  return best;
}

/** Role-based landing route after login */
export function getHomePathForRoles(userRoles: string[]): string {
  const primary = getPrimaryRole(userRoles);
  switch (primary) {
    case "FIELD_LEAD":
      return "/field/projects";
    case "DIVISION_MANAGER":
      return "/approvals";
    case "PROJECT_ADMIN":
      return "/office";
    case "SYSTEM_ADMIN":
      return "/system";
    default:
      return "/app";
  }
}

export const adminRoles = ["SYSTEM_ADMIN", "PROJECT_ADMIN"] as const;
export type AdminRole = (typeof adminRoles)[number];

export function isAdminRole(role: string): role is AdminRole {
  return (adminRoles as readonly string[]).includes(role);
}
