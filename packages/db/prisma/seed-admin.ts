/**
 * Minimal Neon/prod seed — System Admin only (no sample projects/users).
 * Usage: DATABASE_URL="postgresql://..." npm run db:seed:admin -w @frs/db
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  defaultPermissionMatrix,
  permissionCatalog,
  roles as appRoles,
  type AppRole,
  type PermissionAccessValue,
  type PermissionKey,
} from "@frs/shared";
import { PermissionAccess } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPermissions() {
  for (const item of permissionCatalog) {
    const permission = await prisma.permission.upsert({
      where: { key: item.key },
      update: {
        label: item.label,
        description: item.description,
        sortOrder: item.sortOrder,
      },
      create: {
        key: item.key,
        label: item.label,
        description: item.description,
        sortOrder: item.sortOrder,
      },
    });

    const row = defaultPermissionMatrix[item.key as PermissionKey];
    for (const role of appRoles) {
      const access = row[role as AppRole] as PermissionAccessValue;
      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: role as Role,
            permissionId: permission.id,
          },
        },
        update: { access: access as PermissionAccess },
        create: {
          role: role as Role,
          permissionId: permission.id,
          access: access as PermissionAccess,
        },
      });
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required (Neon connection string)");
  }

  console.log("Seeding permission matrix (needed for RBAC)…");
  await seedPermissions();

  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@frs.local" },
    update: {
      passwordHash,
      firstName: "System",
      lastName: "Admin",
      isActive: true,
    },
    create: {
      email: "admin@frs.local",
      passwordHash,
      firstName: "System",
      lastName: "Admin",
      isActive: true,
      roles: { create: [{ role: Role.SYSTEM_ADMIN }] },
    },
    include: { roles: true },
  });

  const hasAdminRole = admin.roles.some((r) => r.role === Role.SYSTEM_ADMIN);
  if (!hasAdminRole) {
    await prisma.userRole.create({
      data: { userId: admin.id, role: Role.SYSTEM_ADMIN },
    });
  }

  console.log("Admin ready:", {
    email: admin.email,
    id: admin.id,
    password: "ChangeMe123!",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
