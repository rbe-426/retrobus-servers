-- CreateTable
CREATE TABLE "IneoConsoleDevice" (
    "id" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "deviceId" TEXT,
    "model" TEXT,
    "appVersion" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IneoConsoleDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IneoConsoleDevice_imei_key" ON "IneoConsoleDevice"("imei");

-- CreateIndex
CREATE INDEX "IneoConsoleDevice_lastSeenAt_idx" ON "IneoConsoleDevice"("lastSeenAt");
