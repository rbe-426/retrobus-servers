-- AlterTable scheduled_operations - add remainingTotalAmount
ALTER TABLE "scheduled_operations" ADD COLUMN IF NOT EXISTS "remainingTotalAmount" DOUBLE PRECISION;

-- CreateTable scheduled_operation_payments
CREATE TABLE IF NOT EXISTS "scheduled_operation_payments" (
    "id" TEXT NOT NULL,
    "scheduledOperationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "attachmentDataUrl" TEXT,

    CONSTRAINT "scheduled_operation_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_operation_payments_paidAt_idx" ON "scheduled_operation_payments"("paidAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_operation_payments_period_idx" ON "scheduled_operation_payments"("period");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_operation_payments_scheduledOperationId_idx" ON "scheduled_operation_payments"("scheduledOperationId");

-- AddForeignKey
ALTER TABLE "scheduled_operation_payments" ADD CONSTRAINT "scheduled_operation_payments_scheduledOperationId_fkey" FOREIGN KEY ("scheduledOperationId") REFERENCES "scheduled_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UpdateData: Initialize remainingTotalAmount
UPDATE "scheduled_operations" SET "remainingTotalAmount" = "totalAmount" WHERE "remainingTotalAmount" IS NULL OR "remainingTotalAmount" = 0;
