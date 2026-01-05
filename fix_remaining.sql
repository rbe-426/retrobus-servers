ALTER TABLE "scheduled_operations" ADD COLUMN IF NOT EXISTS "remainingTotalAmount" DOUBLE PRECISION;
UPDATE "scheduled_operations" SET "remainingTotalAmount" = "totalAmount" WHERE "remainingTotalAmount" IS NULL OR "remainingTotalAmount" = 0;
