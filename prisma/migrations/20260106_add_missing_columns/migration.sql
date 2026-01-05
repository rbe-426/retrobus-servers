-- Add missing columns to scheduled_operations
ALTER TABLE "scheduled_operations" ADD COLUMN IF NOT EXISTS "paymentsCount" INTEGER DEFAULT 0;

-- Make sure remainingTotalAmount exists too
ALTER TABLE "scheduled_operations" ADD COLUMN IF NOT EXISTS "remainingTotalAmount" DOUBLE PRECISION;

-- Initialize remainingTotalAmount for existing records
UPDATE "scheduled_operations" SET "remainingTotalAmount" = "totalAmount" WHERE "remainingTotalAmount" IS NULL;
