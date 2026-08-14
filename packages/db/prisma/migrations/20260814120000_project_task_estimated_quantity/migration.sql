-- Admin-entered plan quantity for project tasks (alternative to STA-derived estimate)
ALTER TABLE "ProjectTask" ADD COLUMN "estimatedQuantity" DECIMAL(14,4);
