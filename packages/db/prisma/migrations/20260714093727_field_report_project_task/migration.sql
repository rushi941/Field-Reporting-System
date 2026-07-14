/*
  Warnings:

  - You are about to drop the column `bidItemId` on the `ReportLineItem` table. All the data in the column will be lost.
  - Added the required column `projectTaskId` to the `ReportLineItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ReportLineItem" DROP CONSTRAINT "ReportLineItem_bidItemId_fkey";

-- DropIndex
DROP INDEX "ReportLineItem_bidItemId_idx";

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "crewSize" INTEGER;

-- AlterTable
ALTER TABLE "ReportLineItem" DROP COLUMN "bidItemId",
ADD COLUMN     "projectTaskId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ReportLineItem_projectTaskId_idx" ON "ReportLineItem"("projectTaskId");

-- AddForeignKey
ALTER TABLE "ReportLineItem" ADD CONSTRAINT "ReportLineItem_projectTaskId_fkey" FOREIGN KEY ("projectTaskId") REFERENCES "ProjectTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
