-- AlterTable
ALTER TABLE "IneoDriverProfile" ADD COLUMN "driverNumber" TEXT,
ADD COLUMN "driverCodeHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "IneoDriverProfile_driverNumber_key" ON "IneoDriverProfile"("driverNumber");
