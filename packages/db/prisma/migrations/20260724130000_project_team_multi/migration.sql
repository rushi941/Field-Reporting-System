-- CreateTable
CREATE TABLE "ProjectFieldLead" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFieldLead_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "ProjectDivisionManager" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDivisionManager_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateIndex
CREATE INDEX "ProjectFieldLead_userId_idx" ON "ProjectFieldLead"("userId");

-- CreateIndex
CREATE INDEX "ProjectDivisionManager_userId_idx" ON "ProjectDivisionManager"("userId");

-- AddForeignKey
ALTER TABLE "ProjectFieldLead" ADD CONSTRAINT "ProjectFieldLead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFieldLead" ADD CONSTRAINT "ProjectFieldLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDivisionManager" ADD CONSTRAINT "ProjectDivisionManager_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDivisionManager" ADD CONSTRAINT "ProjectDivisionManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill from existing single projectManagerId
INSERT INTO "ProjectDivisionManager" ("projectId", "userId")
SELECT "id", "projectManagerId" FROM "Project" WHERE "projectManagerId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill field leads from task assignments
INSERT INTO "ProjectFieldLead" ("projectId", "userId")
SELECT DISTINCT "projectId", "assignedToId" FROM "ProjectTask"
WHERE "assignedToId" IS NOT NULL
ON CONFLICT DO NOTHING;
