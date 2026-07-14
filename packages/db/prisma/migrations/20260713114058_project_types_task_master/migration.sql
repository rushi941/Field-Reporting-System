-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "projectTypeId" TEXT;

-- CreateTable
CREATE TABLE "ProjectType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "division" "Division",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskMaster" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "formType" "BidItemFormType" NOT NULL DEFAULT 'STA_RANGE',
    "projectTypeId" TEXT,
    "division" "Division",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectType_code_key" ON "ProjectType"("code");

-- CreateIndex
CREATE INDEX "ProjectType_isActive_sortOrder_idx" ON "ProjectType"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TaskMaster_code_key" ON "TaskMaster"("code");

-- CreateIndex
CREATE INDEX "TaskMaster_projectTypeId_isActive_idx" ON "TaskMaster"("projectTypeId", "isActive");

-- CreateIndex
CREATE INDEX "TaskMaster_division_isActive_idx" ON "TaskMaster"("division", "isActive");

-- CreateIndex
CREATE INDEX "TaskMaster_formType_idx" ON "TaskMaster"("formType");

-- CreateIndex
CREATE INDEX "Project_projectTypeId_idx" ON "Project"("projectTypeId");

-- AddForeignKey
ALTER TABLE "TaskMaster" ADD CONSTRAINT "TaskMaster_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "ProjectType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "ProjectType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
