-- CreateTable
CREATE TABLE "ClientMaster" (
    "id" TEXT NOT NULL,
    "foundationNumber" INTEGER,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientMaster_name_key" ON "ClientMaster"("name");

-- CreateIndex
CREATE INDEX "ClientMaster_isActive_sortOrder_idx" ON "ClientMaster"("isActive", "sortOrder");
