ALTER TABLE "IneoFreeTrackingSession"
ADD COLUMN "stopByStop" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "IneoFreeTrackingStop" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speedKmh" DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IneoFreeTrackingStop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IneoFreeTrackingStop_sessionId_sequence_key" ON "IneoFreeTrackingStop"("sessionId", "sequence");
CREATE INDEX "IneoFreeTrackingStop_sessionId_recordedAt_idx" ON "IneoFreeTrackingStop"("sessionId", "recordedAt");
ALTER TABLE "IneoFreeTrackingStop" ADD CONSTRAINT "IneoFreeTrackingStop_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "IneoFreeTrackingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;