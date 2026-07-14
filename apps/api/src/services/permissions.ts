import { prisma, type PermissionAccess, type Role } from "@frs/db";
import {
  isPermissionGranted,
  type PermissionAccessValue,
  type PermissionKey,
} from "@frs/shared";

export async function getEffectivePermissions(roles: string[]) {
  if (roles.length === 0) return {} as Record<string, PermissionAccessValue>;

  const rows = await prisma.rolePermission.findMany({
    where: { role: { in: roles as Role[] } },
    include: { permission: true },
  });

  const map: Record<string, PermissionAccessValue> = {};
  for (const row of rows) {
    const key = row.permission.key;
    const access = row.access as PermissionAccessValue;
    const current = map[key];
    if (!current || (!isPermissionGranted(current) && isPermissionGranted(access))) {
      map[key] = access;
    } else if (isPermissionGranted(access) && access === "YES") {
      map[key] = "YES";
    } else if (!current) {
      map[key] = access;
    }
  }
  return map;
}

export async function userHasPermission(
  roles: string[],
  key: PermissionKey | string,
): Promise<boolean> {
  // Bootstrap: System Admin always manages permissions/users if matrix missing
  if (
    roles.includes("SYSTEM_ADMIN") &&
    (key === "users.manage" ||
      key === "permissions.manage" ||
      key === "projects.manage" ||
      key === "foundation.import")
  ) {
    const count = await prisma.permission.count();
    if (count === 0) return true;
  }

  const effective = await getEffectivePermissions(roles);
  const access = effective[key] ?? ("NO" as PermissionAccessValue);
  return isPermissionGranted(access);
}

export async function getPermissionMatrix() {
  const permissions = await prisma.permission.findMany({
    orderBy: { sortOrder: "asc" },
    include: { rolePermissions: true },
  });

  return permissions.map((p) => ({
    id: p.id,
    key: p.key,
    label: p.label,
    description: p.description,
    sortOrder: p.sortOrder,
    accessByRole: Object.fromEntries(
      p.rolePermissions.map((rp) => [rp.role, rp.access as PermissionAccess]),
    ) as Record<string, PermissionAccess>,
  }));
}
