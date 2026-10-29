CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "allDay" BOOLEAN NOT NULL DEFAULT true,
  "kind" TEXT NOT NULL DEFAULT 'EVENT',
  "shared" BOOLEAN NOT NULL DEFAULT false,
  "ownerId" TEXT NOT NULL,
  "ownerName" TEXT,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");
CREATE INDEX IF NOT EXISTS "CalendarEvent_ownerId_idx" ON "CalendarEvent"("ownerId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_shared_idx" ON "CalendarEvent"("shared");
