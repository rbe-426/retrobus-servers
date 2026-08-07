-- AddColumn remainingTotalAmount to scheduled_operations
ALTER TABLE "scheduled_operations" ADD COLUMN "remainingTotalAmount" DOUBLE PRECISION DEFAULT 0;

-- Update existing rows to have remainingTotalAmount = totalAmount (no payment recorded yet)
UPDATE "scheduled_operations" SET "remainingTotalAmount" = "totalAmount" WHERE "remainingTotalAmount" IS NULL OR "remainingTotalAmount" = 0;
