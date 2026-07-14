import { z } from "zod";
import type { AppRole } from "./auth.js";

/** FRD §7.2 permission keys — stored in DB, editable via System Admin matrix */
export const permissionKeys = [
  "auth.login",
  "projects.search",
  "bid_items.view",
  "reports.submit",
  "reports.edit_draft",
  "reports.edit_submitted",
  "reports.edit_returned",
  "reports.approve",
  "reports.approve_with_notes",
  "reports.return",
  "reports.view_pending_queue",
  "reports.view_approved",
  "reports.view_returned",
  "reports.view_project_history",
  "attachments.view",
  "billing.export",
  "users.manage",
  "projects.manage",
  "foundation.import",
  "permissions.manage",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

export const permissionAccessValues = ["YES", "NO"] as const;

export type PermissionAccessValue = (typeof permissionAccessValues)[number];

/** Normalize legacy FRD cell values to Yes/No for the admin matrix UI */
export function toYesNoAccess(access: string): PermissionAccessValue {
  return access === "NO" ? "NO" : "YES";
}

export const permissionCatalog: {
  key: PermissionKey;
  label: string;
  description: string;
  sortOrder: number;
}[] = [
  { key: "auth.login", label: "Login", description: "Sign in to the system", sortOrder: 10 },
  { key: "projects.search", label: "Search active projects", description: "Find and open active jobs", sortOrder: 20 },
  { key: "bid_items.view", label: "View bid items", description: "View bid items for a project", sortOrder: 30 },
  { key: "reports.submit", label: "Submit daily report", description: "Submit field quantity reports", sortOrder: 40 },
  { key: "reports.edit_draft", label: "Edit draft report", description: "Edit own draft reports", sortOrder: 50 },
  { key: "reports.edit_submitted", label: "Edit submitted report", description: "Edit after submit (normally locked)", sortOrder: 60 },
  { key: "reports.edit_returned", label: "Edit returned report", description: "Correct returned reports", sortOrder: 70 },
  { key: "reports.approve", label: "Approve report", description: "Approve pending reports", sortOrder: 80 },
  { key: "reports.approve_with_notes", label: "Approve with notes", description: "Approve and add notes", sortOrder: 90 },
  { key: "reports.return", label: "Return for correction", description: "Return report with comment", sortOrder: 100 },
  { key: "reports.view_pending_queue", label: "View pending approval queue", description: "See pending approvals", sortOrder: 110 },
  { key: "reports.view_approved", label: "View approved reports", description: "See approved report detail", sortOrder: 120 },
  { key: "reports.view_returned", label: "View returned reports", description: "See returned reports", sortOrder: 130 },
  { key: "reports.view_project_history", label: "View project history", description: "Project report history", sortOrder: 140 },
  { key: "attachments.view", label: "View attached documents", description: "View report attachments", sortOrder: 150 },
  { key: "billing.export", label: "Export billing backup", description: "CSV/PDF billing export", sortOrder: 160 },
  { key: "users.manage", label: "Manage users", description: "User CRUD, roles, assignments", sortOrder: 170 },
  { key: "projects.manage", label: "Manage project records", description: "Create/edit projects & bid items", sortOrder: 180 },
  { key: "foundation.import", label: "Import Foundation CSV", description: "Import projects/bid items", sortOrder: 190 },
  { key: "permissions.manage", label: "Manage permission matrix", description: "Edit role permissions", sortOrder: 210 },
];

/** Default FRD §7.2 matrix (role → access). System Admin can change in DB. */
export const defaultPermissionMatrix: Record<
  PermissionKey,
  Record<AppRole, PermissionAccessValue>
> = {
  "auth.login": {
    FIELD_LEAD: "YES",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "YES",
    SYSTEM_ADMIN: "YES",
  },
  "projects.search": {
    FIELD_LEAD: "YES",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "YES",
    SYSTEM_ADMIN: "YES",
  },
  "bid_items.view": {
    FIELD_LEAD: "YES",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "YES",
    SYSTEM_ADMIN: "YES",
  },
  "reports.submit": {
    FIELD_LEAD: "YES",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "NO",
    SYSTEM_ADMIN: "NO",
  },
  "reports.edit_draft": {
    FIELD_LEAD: "YES",
    DIVISION_MANAGER: "NO",
    PROJECT_ADMIN: "NO",
    SYSTEM_ADMIN: "NO",
  },
  "reports.edit_submitted": {
    FIELD_LEAD: "NO",
    DIVISION_MANAGER: "NO",
    PROJECT_ADMIN: "NO",
    SYSTEM_ADMIN: "NO",
  },
  "reports.edit_returned": {
    FIELD_LEAD: "YES",
    DIVISION_MANAGER: "NO",
    PROJECT_ADMIN: "NO",
    SYSTEM_ADMIN: "NO",
  },
  "reports.approve": {
    FIELD_LEAD: "NO",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "NO",
    SYSTEM_ADMIN: "NO",
  },
  "reports.approve_with_notes": {
    FIELD_LEAD: "NO",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "NO",
    SYSTEM_ADMIN: "NO",
  },
  "reports.return": {
    FIELD_LEAD: "NO",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "NO",
    SYSTEM_ADMIN: "NO",
  },
  "reports.view_pending_queue": {
    FIELD_LEAD: "NO",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "YES",
    SYSTEM_ADMIN: "YES",
  },
  "reports.view_approved": {
    FIELD_LEAD: "YES",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "YES",
    SYSTEM_ADMIN: "YES",
  },
  "reports.view_returned": {
    FIELD_LEAD: "YES",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "NO",
    SYSTEM_ADMIN: "YES",
  },
  "reports.view_project_history": {
    FIELD_LEAD: "YES",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "YES",
    SYSTEM_ADMIN: "YES",
  },
  "attachments.view": {
    FIELD_LEAD: "YES",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "YES",
    SYSTEM_ADMIN: "YES",
  },
  "billing.export": {
    FIELD_LEAD: "NO",
    DIVISION_MANAGER: "YES",
    PROJECT_ADMIN: "YES",
    SYSTEM_ADMIN: "YES",
  },
  "users.manage": {
    FIELD_LEAD: "NO",
    DIVISION_MANAGER: "NO",
    PROJECT_ADMIN: "NO",
    SYSTEM_ADMIN: "YES",
  },
  "projects.manage": {
    FIELD_LEAD: "NO",
    DIVISION_MANAGER: "NO",
    PROJECT_ADMIN: "YES",
    SYSTEM_ADMIN: "YES",
  },
  "foundation.import": {
    FIELD_LEAD: "NO",
    DIVISION_MANAGER: "NO",
    PROJECT_ADMIN: "YES",
    SYSTEM_ADMIN: "YES",
  },
  "permissions.manage": {
    FIELD_LEAD: "NO",
    DIVISION_MANAGER: "NO",
    PROJECT_ADMIN: "NO",
    SYSTEM_ADMIN: "YES",
  },
};

export function isPermissionGranted(access: PermissionAccessValue): boolean {
  return access !== "NO";
}

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  division: z
    .enum(["PAVEMENT_MARKING", "TRAFFIC_CONTROL", "PERMANENT_SIGNS"])
    .optional()
    .nullable(),
  managerId: z.string().optional().nullable(),
  crewId: z.string().optional().nullable(),
  roles: z
    .array(z.enum(["FIELD_LEAD", "DIVISION_MANAGER", "PROJECT_ADMIN", "SYSTEM_ADMIN"]))
    .min(1, "Assign at least one role"),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .extend({
    password: z.string().min(8).optional().nullable(),
  })
  .partial()
  .extend({
    roles: z
      .array(z.enum(["FIELD_LEAD", "DIVISION_MANAGER", "PROJECT_ADMIN", "SYSTEM_ADMIN"]))
      .min(1)
      .optional(),
  });

export const updatePermissionMatrixSchema = z.object({
  cells: z.array(
    z.object({
      permissionKey: z.string(),
      role: z.enum(["FIELD_LEAD", "DIVISION_MANAGER", "PROJECT_ADMIN", "SYSTEM_ADMIN"]),
      access: z.enum(permissionAccessValues),
    }),
  ),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
