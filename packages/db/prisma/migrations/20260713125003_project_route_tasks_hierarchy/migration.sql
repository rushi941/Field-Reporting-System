-- AlterTable
ALTER TABLE "TaskMaster" ADD COLUMN     "parentId" TEXT;

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskMasterId" TEXT NOT NULL,
    "division" "Division" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRoute" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "startLabel" TEXT,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLng" DOUBLE PRECISION NOT NULL,
    "endLabel" TEXT,
    "polyline" JSONB,
    "distanceMeters" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_division_isActive_idx" ON "ProjectTask"("projectId", "division", "isActive");

-- CreateIndex
CREATE INDEX "ProjectTask_taskMasterId_idx" ON "ProjectTask"("taskMasterId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTask_projectId_taskMasterId_key" ON "ProjectTask"("projectId", "taskMasterId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRoute_projectId_key" ON "ProjectRoute"("projectId");

-- CreateIndex
CREATE INDEX "TaskMaster_parentId_sortOrder_idx" ON "TaskMaster"("parentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "TaskMaster" ADD CONSTRAINT "TaskMaster_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TaskMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_taskMasterId_fkey" FOREIGN KEY ("taskMasterId") REFERENCES "TaskMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRoute" ADD CONSTRAINT "ProjectRoute_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
