ALTER TABLE "finance_expense_reports"
ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'Note de frais avec justificatif',
ADD COLUMN IF NOT EXISTS "notes" TEXT;