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
  PAINTED_PAVEMENT_MASTER_BIDS,
  PAVEMENT_LINE_SUB_CATALOG,
  subBidCodeForMaster,
  seedProjectTypes,
  seedUnitMasters,
  type AppRole,
  type PermissionAccessValue,
  type PermissionKey,
} from "@frs/shared";
import { seedBigDemoProject, seedDemoUsers } from "./seed-demo.js";

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
  const subCount = await seedPavementSubBids(typeIds);

  return { typeIds, taskIds: {} as Record<string, string>, subCount };
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
  // Clear self-references before bulk delete (Neon re-seed)
  await prisma.taskMaster.updateMany({ data: { parentId: null } });
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

async function seedPavementSubBids(typeIds: Record<string, string>) {
  let count = 0;
  for (const master of PAINTED_PAVEMENT_MASTER_BIDS) {
    const parent = await prisma.taskMaster.findUnique({
      where: { code: master.masterCode },
    });
    if (!parent) {
      console.warn(`Master ${master.masterCode} not found — skip sub-bids`);
      continue;
    }

    for (const line of PAVEMENT_LINE_SUB_CATALOG) {
      const code = subBidCodeForMaster(master.prefix, line.lineCode);
      await prisma.taskMaster.upsert({
        where: { code },
        update: {
          name: line.name,
          description: `${line.name} · ${line.color} · ${line.widthInches}" · CF ${line.conversionFactor} (${line.staBasis}" STA basis)`,
          unit: line.unit,
          formType: line.formType,
          division: "PAVEMENT_MARKING",
          parentId: parent.id,
          color: line.color,
          widthInches: line.widthInches,
          conversionFactor: line.conversionFactor,
          projectTypeId: typeIds.PM ?? null,
          isActive: true,
        },
        create: {
          code,
          name: line.name,
          description: `${line.name} · ${line.color} · ${line.widthInches}" · CF ${line.conversionFactor} (${line.staBasis}" STA basis)`,
          unit: line.unit,
          formType: line.formType,
          division: "PAVEMENT_MARKING",
          parentId: parent.id,
          color: line.color,
          widthInches: line.widthInches,
          conversionFactor: line.conversionFactor,
          projectTypeId: typeIds.PM ?? null,
          sortOrder: count + 1,
        },
      });
      count += 1;
    }
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
  const { typeIds, subCount } = await seedMasters();
  const clientCount = await seedClients();
  const bidCount = await prisma.taskMaster.count();

  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@frs.local" },
    update: { isActive: true },
    create: {
      email: "admin@frs.local",
      passwordHash,
      firstName: "System",
      lastName: "Admin",
      roles: { create: [{ role: Role.SYSTEM_ADMIN }] },
    },
  });

  await prisma.user.upsert({
    where: { email: "padmin@frs.local" },
    update: { isActive: true },
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

  const { userIds, dmCount, leadCount } = await seedDemoUsers(
    prisma,
    passwordHash,
  );

  const demo = await seedBigDemoProject(
    prisma,
    typeIds,
    userIds,
    padmin.id,
  );

  // Small legacy sample project (no tasks — use JOB-2026-DEMO for full demo)
  const project = await prisma.project.upsert({
    where: { jobNumber: "JOB-1001" },
    update: {
      lastSyncedAt: new Date(),
      projectTypeId: typeIds.PM,
      projectAdminId: padmin.id,
      projectManagerId: userIds.get("manager@frs.local") ?? userIds.get("pm@frs.local")!,
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
      projectManagerId: userIds.get("manager@frs.local") ?? userIds.get("pm@frs.local")!,
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
            formType: BidItemFormType.STA_WITH_CF,
          },
          {
            itemNumber: "6201",
            description: "Left Turn Arrow",
            unit: "EA",
            estimatedQuantity: 40,
            formType: BidItemFormType.SINGLE_POINT,
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
    bidMasters: bidCount,
    pavementSubBids: subCount,
    clients: clientCount,
    demoProject: demo.project.jobNumber,
    demoTasks: demo.taskCount,
    demoDivisionManagers: demo.divisionManagerCount,
    demoFieldLeads: demo.fieldLeadCount,
    totalDivisionManagers: dmCount,
    totalFieldLeads: leadCount,
    sampleProject: project.jobNumber,
    loginPassword: "ChangeMe123!",
    demoLogins: {
      projectAdmin: "padmin@frs.local",
      projectManager: "pm@frs.local",
      divisionManager: "dm-pm1@frs.local",
      fieldLead: "lead01@frs.local",
    },
    ...(demo.missingCodes.length
      ? { missingTaskCodes: demo.missingCodes }
      : {}),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
