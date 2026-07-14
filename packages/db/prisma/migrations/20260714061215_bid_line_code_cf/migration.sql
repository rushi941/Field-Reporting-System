-- AlterTable
ALTER TABLE "TaskMaster" ADD COLUMN     "color" TEXT,
ADD COLUMN     "conversionFactor" DECIMAL(12,6),
ADD COLUMN     "widthInches" INTEGER;

-- CreateIndex
CREATE INDEX "TaskMaster_widthInches_idx" ON "TaskMaster"("widthInches");
