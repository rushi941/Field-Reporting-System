/**
 * Verify Neon/production has full demo seed (users, clients, bid masters).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const [users, clients, bidMasters, subBids, demoProject] = await Promise.all([
    prisma.user.count(),
    prisma.clientMaster.count(),
    prisma.taskMaster.count({ where: { parentId: null } }),
    prisma.taskMaster.count({ where: { parentId: { not: null } } }),
    prisma.project.findUnique({
      where: { jobNumber: "JOB-2026-DEMO" },
      select: {
        id: true,
        _count: { select: { tasks: true } },
      },
    }),
  ]);

  const summary = {
    users,
    clients,
    bidMasters,
    subBids,
    demoProject: demoProject?.id ?? null,
    demoTasks: demoProject?._count.tasks ?? 0,
  };
  console.log("[db] seed verification:", summary);

  const ok =
    users >= 15 &&
    clients >= 100 &&
    bidMasters >= 100 &&
    demoProject != null &&
    (demoProject._count.tasks ?? 0) >= 30;

  if (!ok) {
    console.error("[db] Seed verification FAILED — counts too low.");
    process.exit(1);
  }

  console.log("[db] Seed verification OK.");
} finally {
  await prisma.$disconnect();
}
