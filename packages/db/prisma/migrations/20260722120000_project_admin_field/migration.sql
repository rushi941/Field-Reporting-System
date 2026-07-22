-- AlterTable
ALTER TABLE "Project" ADD COLUMN "projectAdminId" TEXT;

-- CreateIndex
CREATE INDEX "Project_projectAdminId_idx" ON "Project"("projectAdminId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectAdminId_fkey" FOREIGN KEY ("projectAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
