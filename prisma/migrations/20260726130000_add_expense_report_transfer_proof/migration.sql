ALTER TABLE "finance_expense_reports"
ADD COLUMN IF NOT EXISTS "transferProofFileName" TEXT,
ADD COLUMN IF NOT EXISTS "transferProofStoredName" TEXT,
ADD COLUMN IF NOT EXISTS "transferProofUploadedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "transferProofUploadedBy" TEXT;