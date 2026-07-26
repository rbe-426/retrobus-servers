ALTER TABLE "IneoRoute"
ADD COLUMN "scheduledDeparture" TEXT,
ADD COLUMN "scheduledArrival" TEXT,
ADD COLUMN "stops" JSONB;