CREATE TABLE "IneoFlash" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduleMode" TEXT NOT NULL DEFAULT 'IMMEDIATE',
    "scheduledAt" TIMESTAMP(3),
    "locationLabel" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "radiusMeters" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IneoFlash_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IneoFlash_active_idx" ON "IneoFlash"("active");
CREATE INDEX "IneoFlash_scheduleMode_idx" ON "IneoFlash"("scheduleMode");

CREATE TABLE "IneoFlashAck" (
    "id" TEXT NOT NULL,
    "flashId" TEXT NOT NULL,
    "driverIdentifier" TEXT NOT NULL,
    "driverName" TEXT,
    "missionId" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IneoFlashAck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IneoFlashAck_flashId_driverIdentifier_key" ON "IneoFlashAck"("flashId", "driverIdentifier");
CREATE INDEX "IneoFlashAck_flashId_idx" ON "IneoFlashAck"("flashId");
CREATE INDEX "IneoFlashAck_driverIdentifier_idx" ON "IneoFlashAck"("driverIdentifier");

ALTER TABLE "IneoFlashAck" ADD CONSTRAINT "IneoFlashAck_flashId_fkey" FOREIGN KEY ("flashId") REFERENCES "IneoFlash"("id") ON DELETE CASCADE ON UPDATE CASCADE;
