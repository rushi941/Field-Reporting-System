-- AlterTable
ALTER TABLE "Report" ADD COLUMN "divisionManagerId" TEXT;

-- CreateIndex
CREATE INDEX "Report_divisionManagerId_idx" ON "Report"("divisionManagerId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_divisionManagerId_fkey" FOREIGN KEY ("divisionManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
