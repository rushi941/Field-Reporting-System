/**
 * Large demo project — division managers, field leads, 30+ assigned tasks.
 */
import {
  PrismaClient,
  Role,
  Division,
  BidItemFormType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  PAVEMENT_LINE_SUB_CATALOG,
  PAINTED_PAVEMENT_MASTER_BIDS,
  subBidCodeForMaster,
} from "@frs/shared";

const DIVISIONS: Division[] = [
  "PAVEMENT_MARKING",
  "TRAFFIC_CONTROL",
  "PERMANENT_SIGNS",
  "MISCELLANEOUS",
];

type SeedUserSpec = {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  division?: Division;
  managerEmail?: string;
};

const DIVISION_MANAGER_SPECS: SeedUserSpec[] = [
  { email: "dm-pm1@frs.local", firstName: "Jordan", lastName: "Marking", role: Role.DIVISION_MANAGER, division: "PAVEMENT_MARKING" },
  { email: "dm-pm2@frs.local", firstName: "Casey", lastName: "Stripe", role: Role.DIVISION_MANAGER, division: "PAVEMENT_MARKING" },
  { email: "dm-pm3@frs.local", firstName: "Riley", lastName: "Lane", role: Role.DIVISION_MANAGER, division: "PAVEMENT_MARKING" },
  { email: "dm-pm4@frs.local", firstName: "Morgan", lastName: "Paint", role: Role.DIVISION_MANAGER, division: "PAVEMENT_MARKING" },
  { email: "dm-tc1@frs.local", firstName: "Avery", lastName: "Cone", role: Role.DIVISION_MANAGER, division: "TRAFFIC_CONTROL" },
  { email: "dm-tc2@frs.local", firstName: "Quinn", lastName: "Barrier", role: Role.DIVISION_MANAGER, division: "TRAFFIC_CONTROL" },
  { email: "dm-tc3@frs.local", firstName: "Blake", lastName: "Flagger", role: Role.DIVISION_MANAGER, division: "TRAFFIC_CONTROL" },
  { email: "dm-ps1@frs.local", firstName: "Drew", lastName: "Sign", role: Role.DIVISION_MANAGER, division: "PERMANENT_SIGNS" },
  { email: "dm-ps2@frs.local", firstName: "Jamie", lastName: "Post", role: Role.DIVISION_MANAGER, division: "PERMANENT_SIGNS" },
  { email: "dm-ps3@frs.local", firstName: "Skyler", lastName: "Legend", role: Role.DIVISION_MANAGER, division: "PERMANENT_SIGNS" },
  { email: "dm-misc1@frs.local", firstName: "Reese", lastName: "Combo", role: Role.DIVISION_MANAGER, division: "MISCELLANEOUS" },
  { email: "dm-misc2@frs.local", firstName: "Cameron", lastName: "Mixed", role: Role.DIVISION_MANAGER, division: "MISCELLANEOUS" },
];

const FIELD_LEAD_SPECS: SeedUserSpec[] = [
  { email: "lead01@frs.local", firstName: "Alex", lastName: "Lead", role: Role.FIELD_LEAD, division: "PAVEMENT_MARKING", managerEmail: "dm-pm1@frs.local" },
  { email: "lead02@frs.local", firstName: "Ben", lastName: "Line", role: Role.FIELD_LEAD, division: "PAVEMENT_MARKING", managerEmail: "dm-pm1@frs.local" },
  { email: "lead03@frs.local", firstName: "Chris", lastName: "Edge", role: Role.FIELD_LEAD, division: "PAVEMENT_MARKING", managerEmail: "dm-pm2@frs.local" },
  { email: "lead04@frs.local", firstName: "Dana", lastName: "Stripe", role: Role.FIELD_LEAD, division: "PAVEMENT_MARKING", managerEmail: "dm-pm2@frs.local" },
  { email: "lead05@frs.local", firstName: "Evan", lastName: "Yellow", role: Role.FIELD_LEAD, division: "PAVEMENT_MARKING", managerEmail: "dm-pm3@frs.local" },
  { email: "lead06@frs.local", firstName: "Finn", lastName: "Cross", role: Role.FIELD_LEAD, division: "PAVEMENT_MARKING", managerEmail: "dm-pm3@frs.local" },
  { email: "lead07@frs.local", firstName: "Grace", lastName: "Walk", role: Role.FIELD_LEAD, division: "PAVEMENT_MARKING", managerEmail: "dm-pm4@frs.local" },
  { email: "lead08@frs.local", firstName: "Harper", lastName: "Curb", role: Role.FIELD_LEAD, division: "PAVEMENT_MARKING", managerEmail: "dm-pm4@frs.local" },
  { email: "lead09@frs.local", firstName: "Ivy", lastName: "TCP", role: Role.FIELD_LEAD, division: "TRAFFIC_CONTROL", managerEmail: "dm-tc1@frs.local" },
  { email: "lead10@frs.local", firstName: "Jesse", lastName: "Pilot", role: Role.FIELD_LEAD, division: "TRAFFIC_CONTROL", managerEmail: "dm-tc2@frs.local" },
  { email: "lead11@frs.local", firstName: "Kelly", lastName: "Arrow", role: Role.FIELD_LEAD, division: "TRAFFIC_CONTROL", managerEmail: "dm-tc2@frs.local" },
  { email: "lead12@frs.local", firstName: "Logan", lastName: "Detour", role: Role.FIELD_LEAD, division: "TRAFFIC_CONTROL", managerEmail: "dm-tc3@frs.local" },
  { email: "lead13@frs.local", firstName: "Maya", lastName: "Sign", role: Role.FIELD_LEAD, division: "PERMANENT_SIGNS", managerEmail: "dm-ps1@frs.local" },
  { email: "lead14@frs.local", firstName: "Noah", lastName: "Post", role: Role.FIELD_LEAD, division: "PERMANENT_SIGNS", managerEmail: "dm-ps2@frs.local" },
  { email: "lead15@frs.local", firstName: "Olivia", lastName: "Legend", role: Role.FIELD_LEAD, division: "PERMANENT_SIGNS", managerEmail: "dm-ps3@frs.local" },
];

/** Demo: tasks assigned per field lead within each division */
const TASKS_PER_LEAD = 4;

function demoPmMasterCodes(count: number): string[] {
  const masters = PAINTED_PAVEMENT_MASTER_BIDS.map((m) => m.masterCode);
  return Array.from({ length: count }, (_, i) => masters[i % masters.length]!);
}

function demoPmSubCodes(count: number): string[] {
  return PAVEMENT_LINE_SUB_CATALOG.slice(0, count).map((line) =>
    subBidCodeForMaster("WB", line.lineCode),
  );
}

async function masterCodesForDivision(
  prisma: PrismaClient,
  division: Division,
  limit: number,
) {
  const rows = await prisma.taskMaster.findMany({
    where: { division, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    take: limit,
    select: { code: true },
  });
  return rows.map((r) => r.code);
}

function buildTaskSpecsForLeads(
  codes: string[],
  division: Division,
  leadEmails: string[],
  staStartMile: number,
) {
  const specs: {
    code: string;
    division: Division;
    leadEmail: string;
    beginSta: string;
    endSta: string;
  }[] = [];

  let mile = staStartMile;
  let leadIdx = 0;
  let onLead = 0;

  for (const code of codes) {
    if (leadIdx >= leadEmails.length) break;
    specs.push({
      code,
      division,
      leadEmail: leadEmails[leadIdx]!,
      beginSta: staLabel(mile, 0),
      endSta: staLabel(mile + 1, 0),
    });
    mile += 1;
    onLead += 1;
    if (onLead >= TASKS_PER_LEAD) {
      onLead = 0;
      leadIdx += 1;
    }
  }

  return specs;
}

function staLabel(miles: number, feet: number): string {
  return `${miles}+${String(feet).padStart(2, "0")}`;
}

export async function seedDemoUsers(
  prisma: PrismaClient,
  passwordHash: string,
) {
  const userIds = new Map<string, string>();

  async function upsertUser(spec: SeedUserSpec) {
    const managerId = spec.managerEmail
      ? userIds.get(spec.managerEmail)
      : undefined;

    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {
        firstName: spec.firstName,
        lastName: spec.lastName,
        division: spec.division ?? null,
        managerId: managerId ?? null,
        isActive: true,
      },
      create: {
        email: spec.email,
        passwordHash,
        firstName: spec.firstName,
        lastName: spec.lastName,
        division: spec.division ?? null,
        managerId: managerId ?? null,
        roles: { create: [{ role: spec.role }] },
      },
    });

    const hasRole = await prisma.userRole.findFirst({
      where: { userId: user.id, role: spec.role },
    });
    if (!hasRole) {
      await prisma.userRole.create({
        data: { userId: user.id, role: spec.role },
      });
    }

    userIds.set(spec.email, user.id);
    return user;
  }

  // Primary project manager (approvals lead for the big job)
  await upsertUser({
    email: "pm@frs.local",
    firstName: "Patricia",
    lastName: "Manager",
    role: Role.DIVISION_MANAGER,
    division: "PAVEMENT_MARKING",
  });

  for (const spec of DIVISION_MANAGER_SPECS) {
    await upsertUser(spec);
  }

  for (const spec of FIELD_LEAD_SPECS) {
    await upsertUser(spec);
  }

  // Legacy accounts kept for quick login tests
  await upsertUser({
    email: "lead@frs.local",
    firstName: "Alex",
    lastName: "Lead",
    role: Role.FIELD_LEAD,
    division: "PAVEMENT_MARKING",
    managerEmail: "dm-pm1@frs.local",
  });
  await upsertUser({
    email: "manager@frs.local",
    firstName: "Division",
    lastName: "Manager",
    role: Role.DIVISION_MANAGER,
    division: "PAVEMENT_MARKING",
  });
  await upsertUser({
    email: "tclead@frs.local",
    firstName: "Taylor",
    lastName: "TCP",
    role: Role.FIELD_LEAD,
    division: "TRAFFIC_CONTROL",
    managerEmail: "dm-tc1@frs.local",
  });
  await upsertUser({
    email: "signlead@frs.local",
    firstName: "Sam",
    lastName: "Signs",
    role: Role.FIELD_LEAD,
    division: "PERMANENT_SIGNS",
    managerEmail: "dm-ps1@frs.local",
  });

  const dmCount = DIVISION_MANAGER_SPECS.length + 1; // + pm@frs.local
  const leadCount = FIELD_LEAD_SPECS.length + 3; // legacy leads

  return { userIds, dmCount, leadCount };
}

export async function seedBigDemoProject(
  prisma: PrismaClient,
  typeIds: Record<string, string>,
  userIds: Map<string, string>,
  projectAdminId: string,
) {
  const pmId = userIds.get("pm@frs.local");
  if (!pmId) throw new Error("pm@frs.local not seeded");

  const divisionManagerIds = [
    "pm@frs.local",
    ...DIVISION_MANAGER_SPECS.map((d) => d.email),
  ]
    .map((email) => userIds.get(email))
    .filter((id): id is string => Boolean(id));

  const fieldLeadIds = FIELD_LEAD_SPECS.map((l) => l.email)
    .map((email) => userIds.get(email))
    .filter((id): id is string => Boolean(id));

  const project = await prisma.project.upsert({
    where: { jobNumber: "JOB-2026-DEMO" },
    update: {
      name: "I-35 Multi-Division Corridor — Full Demo",
      division: "PAVEMENT_MARKING",
      extraDivisions: ["TRAFFIC_CONTROL", "PERMANENT_SIGNS", "MISCELLANEOUS"],
      projectTypeId: typeIds.PM ?? null,
      projectAdminId,
      projectManagerId: pmId,
      clientName: "Texas DOT",
      generalContractor: "Advance Traffic Control LLC",
      location: "I-35, Dallas County, TX — 12.4 mi",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2027-03-31T00:00:00.000Z"),
      contractAmount: 8750000,
      notes:
        "Full demo job: 12 division managers, 15 field leads, 30 work tasks across PM / TC / PS. Night work OK.",
      status: "ACTIVE",
      lastSyncedAt: new Date(),
    },
    create: {
      jobNumber: "JOB-2026-DEMO",
      name: "I-35 Multi-Division Corridor — Full Demo",
      division: "PAVEMENT_MARKING",
      extraDivisions: ["TRAFFIC_CONTROL", "PERMANENT_SIGNS", "MISCELLANEOUS"],
      projectTypeId: typeIds.PM ?? null,
      projectAdminId,
      projectManagerId: pmId,
      clientName: "Texas DOT",
      generalContractor: "Advance Traffic Control LLC",
      location: "I-35, Dallas County, TX — 12.4 mi",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2027-03-31T00:00:00.000Z"),
      contractAmount: 8750000,
      notes:
        "Full demo job: 12 division managers, 15 field leads, 30 work tasks across PM / TC / PS. Night work OK.",
      status: "ACTIVE",
      lastSyncedAt: new Date(),
    },
  });

  await prisma.projectFieldLead.deleteMany({ where: { projectId: project.id } });
  await prisma.projectDivisionManager.deleteMany({
    where: { projectId: project.id },
  });
  await prisma.projectTask.deleteMany({ where: { projectId: project.id } });

  if (fieldLeadIds.length) {
    await prisma.projectFieldLead.createMany({
      data: fieldLeadIds.map((userId) => ({ projectId: project.id, userId })),
    });
  }
  if (divisionManagerIds.length) {
    await prisma.projectDivisionManager.createMany({
      data: divisionManagerIds.map((userId) => ({
        projectId: project.id,
        userId,
      })),
    });
  }

  await prisma.projectRoute.upsert({
    where: { projectId: project.id },
    update: {
      label: "I-35 mainline limits",
      startLat: 32.7767,
      startLng: -96.797,
      startLabel: "Begin — Dallas south",
      endLat: 32.8412,
      endLng: -96.7845,
      endLabel: "End — Richardson",
      beginSta: "0+00",
      endSta: "30+00",
      polyline: [
        [32.7767, -96.797],
        [32.805, -96.791],
        [32.8412, -96.7845],
      ],
      distanceMeters: 198000,
    },
    create: {
      projectId: project.id,
      label: "I-35 mainline limits",
      startLat: 32.7767,
      startLng: -96.797,
      startLabel: "Begin — Dallas south",
      endLat: 32.8412,
      endLng: -96.7845,
      endLabel: "End — Richardson",
      beginSta: "0+00",
      endSta: "30+00",
      polyline: [
        [32.7767, -96.797],
        [32.805, -96.791],
        [32.8412, -96.7845],
      ],
      distanceMeters: 198000,
    },
  });

  const pmLeads = FIELD_LEAD_SPECS.filter(
    (l) => l.division === "PAVEMENT_MARKING",
  ).map((l) => l.email);
  const tcLeads = FIELD_LEAD_SPECS.filter(
    (l) => l.division === "TRAFFIC_CONTROL",
  ).map((l) => l.email);
  const psLeads = FIELD_LEAD_SPECS.filter(
    (l) => l.division === "PERMANENT_SIGNS",
  ).map((l) => l.email);

  const pmCodes = demoPmMasterCodes(pmLeads.length * TASKS_PER_LEAD);
  const tcCodes = await masterCodesForDivision(
    prisma,
    "TRAFFIC_CONTROL",
    tcLeads.length * TASKS_PER_LEAD,
  );
  const psCodes = await masterCodesForDivision(
    prisma,
    "PERMANENT_SIGNS",
    psLeads.length * TASKS_PER_LEAD,
  );

  const taskSpecs = [
    ...buildTaskSpecsForLeads(pmCodes, "PAVEMENT_MARKING", pmLeads, 0),
    ...buildTaskSpecsForLeads(tcCodes, "TRAFFIC_CONTROL", tcLeads, 25),
    ...buildTaskSpecsForLeads(psCodes, "PERMANENT_SIGNS", psLeads, 28),
  ];

  let sortOrder = 0;
  let createdTasks = 0;
  const missingCodes: string[] = [];

  for (const spec of taskSpecs) {
    const master = await prisma.taskMaster.findUnique({
      where: { code: spec.code.toUpperCase() },
    });
    if (!master) {
      missingCodes.push(spec.code);
      continue;
    }

    const assignedToId = userIds.get(spec.leadEmail);
    if (!assignedToId) continue;

    await prisma.projectTask.create({
      data: {
        projectId: project.id,
        taskMasterId: master.id,
        assignedToId,
        division: spec.division,
        sortOrder: sortOrder++,
        beginSta: spec.beginSta,
        endSta: spec.endSta,
        isActive: true,
      },
    });
    createdTasks += 1;
  }

  return {
    project,
    taskCount: createdTasks,
    divisionManagerCount: divisionManagerIds.length,
    fieldLeadCount: fieldLeadIds.length,
    missingCodes,
  };
}

export { DIVISION_MANAGER_SPECS, FIELD_LEAD_SPECS, TASKS_PER_LEAD };
