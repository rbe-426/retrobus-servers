CREATE TABLE "IneoVehicleTracker" (
    "id" TEXT NOT NULL,
    "vehicleParc" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "lastLatitude" DOUBLE PRECISION,
    "lastLongitude" DOUBLE PRECISION,
    "lastSpeedKmh" DOUBLE PRECISION,
    "lastAccuracy" DOUBLE PRECISION,
    "lastPositionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IneoVehicleTracker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IneoRoute" (
    "id" TEXT NOT NULL,
    "courseReference" TEXT NOT NULL,
    "lineName" TEXT,
    "routeName" TEXT NOT NULL,
    "origin" TEXT,
    "destination" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IneoRoute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IneoVehicleTracker_vehicleParc_key" ON "IneoVehicleTracker"("vehicleParc");
CREATE UNIQUE INDEX "IneoVehicleTracker_imei_key" ON "IneoVehicleTracker"("imei");
CREATE INDEX "IneoVehicleTracker_imei_idx" ON "IneoVehicleTracker"("imei");
CREATE INDEX "IneoVehicleTracker_lastPositionAt_idx" ON "IneoVehicleTracker"("lastPositionAt");
CREATE UNIQUE INDEX "IneoRoute_courseReference_key" ON "IneoRoute"("courseReference");
CREATE INDEX "IneoRoute_lineName_idx" ON "IneoRoute"("lineName");

ALTER TABLE "IneoVehicleTracker"
ADD CONSTRAINT "IneoVehicleTracker_vehicleParc_fkey"
FOREIGN KEY ("vehicleParc") REFERENCES "Vehicle"("parc") ON DELETE CASCADE ON UPDATE CASCADE;