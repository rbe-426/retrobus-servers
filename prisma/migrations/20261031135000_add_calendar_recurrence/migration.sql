ALTER TABLE "CalendarEvent"
  ADD COLUMN IF NOT EXISTS "recurrence" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "recurrenceEndAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CalendarEvent_recurrence_recurrenceEndAt_idx"
  ON "CalendarEvent"("recurrence", "recurrenceEndAt");
