-- AlterTable
ALTER TABLE "IneoDesktopRelease" ADD COLUMN "product" TEXT NOT NULL DEFAULT 'UC';

-- DropIndex
DROP INDEX "IneoDesktopRelease_version_key";

-- CreateIndex
CREATE UNIQUE INDEX "IneoDesktopRelease_product_version_key" ON "IneoDesktopRelease"("product", "version");

-- CreateTable
CREATE TABLE "MaintenancePc" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hostname" TEXT,
    "appVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenancePc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenancePc_serial_key" ON "MaintenancePc"("serial");
