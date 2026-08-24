CREATE TABLE "IneoFreeTrackingSession" (
    "id" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "vehicleParc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "driverIdentifier" TEXT,
    "driverName" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "distanceMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxSpeedKmh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastLatitude" DOUBLE PRECISION,
    "lastLongitude" DOUBLE PRECISION,
    "lastSpeedKmh" DOUBLE PRECISION,
    "lastRecordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IneoFreeTrackingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IneoFreeTrackingPosition" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speedKmh" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "distanceM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IneoFreeTrackingPosition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IneoFreeTrackingSession_courseCode_key" ON "IneoFreeTrackingSession"("courseCode");
CREATE INDEX "IneoFreeTrackingSession_trackerId_idx" ON "IneoFreeTrackingSession"("trackerId");
CREATE INDEX "IneoFreeTrackingSession_vehicleParc_idx" ON "IneoFreeTrackingSession"("vehicleParc");
CREATE INDEX "IneoFreeTrackingSession_status_idx" ON "IneoFreeTrackingSession"("status");
CREATE INDEX "IneoFreeTrackingPosition_sessionId_recordedAt_idx" ON "IneoFreeTrackingPosition"("sessionId", "recordedAt");

ALTER TABLE "IneoFreeTrackingPosition"
ADD CONSTRAINT "IneoFreeTrackingPosition_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "IneoFreeTrackingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;