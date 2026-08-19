ALTER TABLE "members"
  ADD COLUMN IF NOT EXISTS "retroMailPasswordResetRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "retroMailPasswordResetAt" TIMESTAMP(3);