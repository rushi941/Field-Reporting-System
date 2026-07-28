/**
 * Dev seed — users, permissions, USA road contractor masters, sample project.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

  // Bid master from Bid Item List.xlsx
  await seedBidMasters(typeIds);

  return { typeIds, taskIds: {} as Record<string, string> };
}

async function seedBidMasters(typeIds: Record<string, string>) {
  const seedPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "bid-seed.json",
  );
  if (!fs.existsSync(seedPath)) {
    console.warn("bid-seed.json not found — skipping bid master seed");
    return 0;
  }

  const rows = JSON.parse(fs.readFileSync(seedPath, "utf8")) as {
    code: string;
    name: string;
    unit: string;
    formType: BidItemFormType;
    projectTypeCode?: string | null;
    division?: Division | null;
    description?: string | null;
    sortOrder?: number;
  }[];

  await prisma.reportLineItem.deleteMany({});
  await prisma.projectTask.deleteMany({});
  await prisma.taskMaster.deleteMany({});

  let count = 0;
  for (const row of rows) {
    const code = row.code.toUpperCase();
    await prisma.taskMaster.create({
      data: {
        code,
        name: row.name,
        description: row.description ?? row.name,
        unit: row.unit.trim().toUpperCase(),
        formType: row.formType,
        projectTypeId: row.projectTypeCode
          ? typeIds[row.projectTypeCode] ?? null
          : null,
        division: row.division ?? null,
        sortOrder: row.sortOrder ?? count + 1,
      },
    });
    count += 1;
  }
  return count;
}

async function seedClients() {
  const seedPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "client-seed.json",
  );
  if (!fs.existsSync(seedPath)) {
    console.warn("client-seed.json not found — skipping client master seed");
    return 0;
  }

  const rows = JSON.parse(fs.readFileSync(seedPath, "utf8")) as {
    foundationNumber?: number | null;
    name: string;
  }[];

  let count = 0;
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;
    await prisma.clientMaster.upsert({
      where: { name },
      update: {
        foundationNumber: row.foundationNumber ?? null,
        sortOrder: row.foundationNumber ?? 0,
        isActive: true,
      },
      create: {
        name,
        foundationNumber: row.foundationNumber ?? null,
        sortOrder: row.foundationNumber ?? 0,
      },
    });
    count += 1;
  }
  return count;
}

async function main() {
  await seedPermissions();
  const { typeIds } = await seedMasters();
  const clientCount = await seedClients();
  const bidCount = await prisma.taskMaster.count();

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
    update: {
      firstName: "Division",
      lastName: "Manager",
    },
    create: {
      email: "manager@frs.local",
      passwordHash,
      firstName: "Division",
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
      beginSta: "1+00",
      endSta: "10+00",
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
      beginSta: "1+00",
      endSta: "10+00",
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
    tasks: bidCount,
    clients: clientCount,
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
