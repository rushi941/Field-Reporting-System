-- Four explicit form types + line item detail fields

CREATE TYPE "BidItemFormType_new" AS ENUM (
  'STA_WITH_CF',
  'STA_NO_CF',
  'SINGLE_POINT',
  'QUANTITY_ONLY'
);

ALTER TABLE "TaskMaster" ALTER COLUMN "formType" DROP DEFAULT;
ALTER TABLE "TaskMaster" ALTER COLUMN "formType" TYPE "BidItemFormType_new" USING (
  CASE "formType"::text
    WHEN 'STA_RANGE' THEN 'STA_WITH_CF'::"BidItemFormType_new"
    WHEN 'SINGLE_LOCATION' THEN 'SINGLE_POINT'::"BidItemFormType_new"
    ELSE 'SINGLE_POINT'::"BidItemFormType_new"
  END
);

ALTER TABLE "BidItem" ALTER COLUMN "formType" TYPE "BidItemFormType_new" USING (
  CASE "formType"::text
    WHEN 'STA_RANGE' THEN 'STA_WITH_CF'::"BidItemFormType_new"
    WHEN 'SINGLE_LOCATION' THEN 'SINGLE_POINT'::"BidItemFormType_new"
    ELSE 'SINGLE_POINT'::"BidItemFormType_new"
  END
);

DROP TYPE "BidItemFormType";
ALTER TYPE "BidItemFormType_new" RENAME TO "BidItemFormType";

ALTER TABLE "TaskMaster" ALTER COLUMN "formType" SET DEFAULT 'STA_WITH_CF';

ALTER TABLE "ReportLineItem" ADD COLUMN IF NOT EXISTS "lineTypeCode" TEXT;
ALTER TABLE "ReportLineItem" ADD COLUMN IF NOT EXISTS "side" TEXT;
