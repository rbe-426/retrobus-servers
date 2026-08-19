CREATE TABLE "IneoVehicleProfile" (
    "id" TEXT NOT NULL,
    "vehicleParc" TEXT NOT NULL,
    "vehicleType" TEXT,
    "maxSpeedKmh" INTEGER,
    "lengthM" DOUBLE PRECISION,
    "widthM" DOUBLE PRECISION,
    "heightM" DOUBLE PRECISION,
    "options" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IneoVehicleProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IneoVehicleProfile_vehicleParc_key" ON "IneoVehicleProfile"("vehicleParc");

ALTER TABLE "IneoVehicleProfile"
ADD CONSTRAINT "IneoVehicleProfile_vehicleParc_fkey"
FOREIGN KEY ("vehicleParc") REFERENCES "Vehicle"("parc") ON DELETE CASCADE ON UPDATE CASCADE;
