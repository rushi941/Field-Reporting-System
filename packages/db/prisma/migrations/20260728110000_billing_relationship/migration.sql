-- CreateEnum
CREATE TYPE "BillingRelationship" AS ENUM ('DIRECT_CLIENT', 'CLIENT_AND_GC', 'GC_DIRECT');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "billingRelationship" "BillingRelationship" NOT NULL DEFAULT 'DIRECT_CLIENT';

-- Backfill from existing client / GC names
UPDATE "Project"
SET "billingRelationship" = 'CLIENT_AND_GC'
WHERE NULLIF(TRIM("clientName"), '') IS NOT NULL
  AND NULLIF(TRIM("generalContractor"), '') IS NOT NULL;

UPDATE "Project"
SET "billingRelationship" = 'GC_DIRECT'
WHERE "billingRelationship" = 'DIRECT_CLIENT'
  AND NULLIF(TRIM("generalContractor"), '') IS NOT NULL
  AND NULLIF(TRIM("clientName"), '') IS NULL;
