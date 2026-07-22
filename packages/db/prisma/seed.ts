/**
 * Dev seed — users, permissions, USA road contractor masters, sample project.
 */
import {
  PrismaClient,
  Role,
  Division,
  BidItemFormType,
  PermissionAccess,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  defaultPermissionMatrix,
  permissionCatalog,
  roles as appRoles,
  seedProjectTypes,
  seedTaskMasters,
  seedUnitMasters,
  type AppRole,
  type PermissionAccessValue,
  type PermissionKey,
} from "@frs/shared";

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

async function seedMasters() {
  const typeIds: Record<string, string> = {};

  for (const u of seedUnitMasters) {
    await prisma.unitMaster.upsert({
      where: { code: u.code },
      update: {
        name: u.name,
        sortOrder: u.sortOrder,
        isActive: true,
      },
      create: {
        code: u.code,
        name: u.name,
        sortOrder: u.sortOrder,
      },
    });
  }

  await prisma.unitMaster.updateMany({
    where: { code: { in: ["DAY", "HR"] } },
    data: { isActive: false },
  });

  for (const t of seedProjectTypes) {
    const row = await prisma.projectType.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        description: t.description,
        division: t.division,
        sortOrder: t.sortOrder,
        isActive: true,
      },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        division: t.division,
        sortOrder: t.sortOrder,
      },
    });
    typeIds[t.code] = row.id;
  }

  // Parents first, then children (so parentId resolves)
  const parents = seedTaskMasters.filter((t) => !t.parentCode);
  const children = seedTaskMasters.filter((t) => t.parentCode);
  const taskIds: Record<string, string> = {};

  for (const task of [...parents, ...children]) {
    const parentId = task.parentCode ? taskIds[task.parentCode] ?? null : null;
    const row = await prisma.taskMaster.upsert({
      where: { code: task.code },
      update: {
        name: task.name,
        description: task.description,
        unit: task.unit,
        formType: task.formType as BidItemFormType,
        projectTypeId: typeIds[task.projectTypeCode] ?? null,
        division: task.division,
        parentId,
        color: task.color ?? null,
        widthInches: task.widthInches ?? null,
        conversionFactor: task.conversionFactor ?? null,
        sortOrder: task.sortOrder,
        isActive: true,
      },
      create: {
        code: task.code,
        name: task.name,
        description: task.description,
        unit: task.unit,
        formType: task.formType as BidItemFormType,
        projectTypeId: typeIds[task.projectTypeCode] ?? null,
        division: task.division,
        parentId,
        color: task.color ?? null,
        widthInches: task.widthInches ?? null,
        conversionFactor: task.conversionFactor ?? null,
        sortOrder: task.sortOrder,
      },
    });
    taskIds[task.code] = row.id;
  }

  return { typeIds, taskIds };
}

async function main() {
  await seedPermissions();
  const { typeIds } = await seedMasters();

  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@frs.local" },
    update: {},
    create: {
      email: "admin@frs.local",
      passwordHash,
      firstName: "System",
      lastName: "Admin",
      roles: { create: [{ role: Role.SYSTEM_ADMIN }] },
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@frs.local" },
    update: {},
    create: {
      email: "manager@frs.local",
      passwordHash,
      firstName: "Dana",
      lastName: "Manager",
      division: Division.PAVEMENT_MARKING,
      roles: { create: [{ role: Role.DIVISION_MANAGER }] },
    },
  });

  const crew = await prisma.crew.upsert({
    where: { id: "seed-crew-marking-1" },
    update: {
      name: "Marking Crew A",
      division: Division.PAVEMENT_MARKING,
      managerId: manager.id,
    },
    create: {
      id: "seed-crew-marking-1",
      name: "Marking Crew A",
      division: Division.PAVEMENT_MARKING,
      managerId: manager.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "lead@frs.local" },
    update: {
      managerId: manager.id,
      crewId: crew.id,
      division: Division.PAVEMENT_MARKING,
      isActive: true,
    },
    create: {
      email: "lead@frs.local",
      passwordHash,
      firstName: "Alex",
      lastName: "Lead",
      division: Division.PAVEMENT_MARKING,
      managerId: manager.id,
      crewId: crew.id,
      roles: { create: [{ role: Role.FIELD_LEAD }] },
    },
  });

  await prisma.user.upsert({
    where: { email: "tclead@frs.local" },
    update: { division: Division.TRAFFIC_CONTROL, isActive: true },
    create: {
      email: "tclead@frs.local",
      passwordHash,
      firstName: "Taylor",
      lastName: "TCP",
      division: Division.TRAFFIC_CONTROL,
      managerId: manager.id,
      roles: { create: [{ role: Role.FIELD_LEAD }] },
    },
  });

  await prisma.user.upsert({
    where: { email: "signlead@frs.local" },
    update: { division: Division.PERMANENT_SIGNS, isActive: true },
    create: {
      email: "signlead@frs.local",
      passwordHash,
      firstName: "Sam",
      lastName: "Signs",
      division: Division.PERMANENT_SIGNS,
      managerId: manager.id,
      roles: { create: [{ role: Role.FIELD_LEAD }] },
    },
  });

  await prisma.user.upsert({
    where: { email: "padmin@frs.local" },
    update: {},
    create: {
      email: "padmin@frs.local",
      passwordHash,
      firstName: "Pat",
      lastName: "Admin",
      roles: { create: [{ role: Role.PROJECT_ADMIN }] },
    },
  });

  const padmin = await prisma.user.findUniqueOrThrow({
    where: { email: "padmin@frs.local" },
  });

  const project = await prisma.project.upsert({
    where: { jobNumber: "JOB-1001" },
    update: {
      lastSyncedAt: new Date(),
      projectTypeId: typeIds.PM,
      projectAdminId: padmin.id,
      projectManagerId: manager.id,
      clientName: "Iowa DOT",
      generalContractor: "Sample GC Constructors",
      location: "US-30, Story County, IA",
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      endDate: new Date("2026-11-30T00:00:00.000Z"),
      contractAmount: 485000,
      notes: "Night work permitted Sun–Thu. Thermoplastic edge line + TCP.",
    },
    create: {
      jobNumber: "JOB-1001",
      name: "US-30 Pavement Marking",
      division: Division.PAVEMENT_MARKING,
      projectTypeId: typeIds.PM,
      projectAdminId: padmin.id,
      projectManagerId: manager.id,
      clientName: "Iowa DOT",
      generalContractor: "Sample GC Constructors",
      location: "US-30, Story County, IA",
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      endDate: new Date("2026-11-30T00:00:00.000Z"),
      contractAmount: 485000,
      notes: "Night work permitted Sun–Thu. Thermoplastic edge line + TCP.",
      lastSyncedAt: new Date(),
      bidItems: {
        create: [
          {
            itemNumber: "6101",
            description: '4" Solid White Edge Line',
            unit: "LF",
            estimatedQuantity: 50000,
            formType: BidItemFormType.STA_RANGE,
          },
          {
            itemNumber: "6201",
            description: "Left Turn Arrow",
            unit: "EA",
            estimatedQuantity: 40,
            formType: BidItemFormType.SINGLE_LOCATION,
          },
        ],
      },
    },
  });

  // Clear any previous project↔bid links (catalog replaced separately)
  await prisma.projectTask.deleteMany({ where: { projectId: project.id } });

  // Sample pinned route along US-30 near Ames, IA
  await prisma.projectRoute.upsert({
    where: { projectId: project.id },
    update: {
      label: "US-30 work limits",
      startLat: 42.0308,
      startLng: -93.6319,
      startLabel: "Begin — Ames west",
      endLat: 42.0345,
      endLng: -93.5201,
      endLabel: "End — toward Nevada",
      polyline: [
        [42.0308, -93.6319],
        [42.032, -93.59],
        [42.0345, -93.5201],
      ],
      distanceMeters: 9200,
    },
    create: {
      projectId: project.id,
      label: "US-30 work limits",
      startLat: 42.0308,
      startLng: -93.6319,
      startLabel: "Begin — Ames west",
      endLat: 42.0345,
      endLng: -93.5201,
      endLabel: "End — toward Nevada",
      polyline: [
        [42.0308, -93.6319],
        [42.032, -93.59],
        [42.0345, -93.5201],
      ],
      distanceMeters: 9200,
    },
  });

  console.log("Seed OK:", {
    admin: admin.email,
    projectTypes: seedProjectTypes.length,
    tasks: seedTaskMasters.length,
    project: project.jobNumber,
    password: "ChangeMe123!",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
