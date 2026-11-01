ALTER TABLE "IneoVehicleProfile" ADD COLUMN IF NOT EXISTS "ucSerial" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "IneoVehicleProfile_ucSerial_key" ON "IneoVehicleProfile"("ucSerial");

CREATE TABLE IF NOT EXISTS "IneoUcDevice" (
  "id" TEXT NOT NULL,
  "serial" TEXT NOT NULL,
  "hostname" TEXT,
  "appVersion" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IneoUcDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IneoUcDevice_serial_key" ON "IneoUcDevice"("serial");
CREATE INDEX IF NOT EXISTS "IneoUcDevice_lastSeenAt_idx" ON "IneoUcDevice"("lastSeenAt");
