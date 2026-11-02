-- AlterTable
ALTER TABLE "IneoUcDevice" ADD COLUMN     "networkOnline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "screensRevision" TEXT;

-- AlterTable
ALTER TABLE "IneoVehicleProfile" ADD COLUMN     "screenProfileId" TEXT;

-- CreateTable
CREATE TABLE "IneoMedia" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IneoMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IneoScreenProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IneoScreenProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IneoScreen" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "place" TEXT NOT NULL DEFAULT 'CUSTOM',
    "x" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "widthPct" DOUBLE PRECISION NOT NULL DEFAULT 16,
    "widthPx" INTEGER NOT NULL DEFAULT 1280,
    "heightPx" INTEGER NOT NULL DEFAULT 720,
    "offlineMediaId" TEXT,
    "onlineMediaId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IneoScreen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IneoPilotVehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Véhicule pilote',
    "ucSerial" TEXT,
    "screenProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IneoPilotVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IneoPilotCommand" (
    "id" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IneoPilotCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IneoScreenProfile_name_key" ON "IneoScreenProfile"("name");

-- CreateIndex
CREATE INDEX "IneoScreen_profileId_idx" ON "IneoScreen"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "IneoPilotVehicle_ucSerial_key" ON "IneoPilotVehicle"("ucSerial");

-- CreateIndex
CREATE INDEX "IneoPilotCommand_pilotId_status_idx" ON "IneoPilotCommand"("pilotId", "status");

-- CreateIndex
CREATE INDEX "IneoPilotCommand_createdAt_idx" ON "IneoPilotCommand"("createdAt");

-- CreateIndex
CREATE INDEX "IneoVehicleProfile_screenProfileId_idx" ON "IneoVehicleProfile"("screenProfileId");

-- AddForeignKey
ALTER TABLE "IneoVehicleProfile" ADD CONSTRAINT "IneoVehicleProfile_screenProfileId_fkey" FOREIGN KEY ("screenProfileId") REFERENCES "IneoScreenProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IneoScreen" ADD CONSTRAINT "IneoScreen_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "IneoScreenProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IneoPilotVehicle" ADD CONSTRAINT "IneoPilotVehicle_screenProfileId_fkey" FOREIGN KEY ("screenProfileId") REFERENCES "IneoScreenProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IneoPilotCommand" ADD CONSTRAINT "IneoPilotCommand_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "IneoPilotVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
