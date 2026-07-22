CREATE TABLE "VehicleRegistrationDocument" (
    "id" TEXT NOT NULL,
    "parc" TEXT NOT NULL,
    "oldCGPath" TEXT,
    "oldCGFileName" TEXT,
    "newCGPath" TEXT,
    "newCGFileName" TEXT,
    "oldCGBarred" BOOLEAN NOT NULL DEFAULT false,
    "temporaryStart" TIMESTAMP(3),
    "temporaryEnd" TIMESTAMP(3),
    "notes" TEXT,
    "dateImport" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleRegistrationDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VehicleRegistrationDocument_parc_key" ON "VehicleRegistrationDocument"("parc");

CREATE TABLE "VehicleSpeedLimiter" (
    "id" TEXT NOT NULL,
    "parc" TEXT NOT NULL,
    "attestationPath" TEXT,
    "fileName" TEXT,
    "checkedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "appointmentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleSpeedLimiter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VehicleSpeedLimiter_parc_key" ON "VehicleSpeedLimiter"("parc");

INSERT INTO "VehicleSpeedLimiter" ("id", "parc", "checkedAt", "validUntil", "createdAt", "updatedAt")
SELECT 'speed-limiter-920', '920', TIMESTAMP '2025-04-13 00:00:00', TIMESTAMP '2026-04-13 00:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Vehicle" WHERE "parc" = '920')
ON CONFLICT ("parc") DO NOTHING;