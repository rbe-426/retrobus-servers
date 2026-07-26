CREATE TYPE "IneoMissionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TABLE "IneoMission" (
  "id" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "serviceReference" TEXT,
  "vehicleParc" TEXT NOT NULL,
  "driverIdentifier" TEXT NOT NULL,
  "driverName" TEXT,
  "status" "IneoMissionStatus" NOT NULL DEFAULT 'PLANNED',
  "scheduledDeparture" TIMESTAMP(3),
  "scheduledArrival" TIMESTAMP(3),
  "actualDeparture" TIMESTAMP(3),
  "actualArrival" TIMESTAMP(3),
  "lastLatitude" DOUBLE PRECISION,
  "lastLongitude" DOUBLE PRECISION,
  "lastSpeedKmh" DOUBLE PRECISION,
  "lastAccuracy" DOUBLE PRECISION,
  "lastPositionAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IneoMission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IneoMission_vehicleParc_fkey" FOREIGN KEY ("vehicleParc") REFERENCES "Vehicle"("parc") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "IneoPosition" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "speedKmh" DOUBLE PRECISION,
  "accuracy" DOUBLE PRECISION,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IneoPosition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IneoPosition_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "IneoMission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "IneoMission_vehicleParc_idx" ON "IneoMission"("vehicleParc");
CREATE INDEX "IneoMission_driverIdentifier_idx" ON "IneoMission"("driverIdentifier");
CREATE INDEX "IneoMission_status_idx" ON "IneoMission"("status");
CREATE INDEX "IneoMission_scheduledDeparture_idx" ON "IneoMission"("scheduledDeparture");
CREATE INDEX "IneoPosition_missionId_idx" ON "IneoPosition"("missionId");
CREATE INDEX "IneoPosition_recordedAt_idx" ON "IneoPosition"("recordedAt");