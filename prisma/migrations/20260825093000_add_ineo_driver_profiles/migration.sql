CREATE TABLE "IneoDriverProfile" (
    "id" TEXT NOT NULL,
    "driverIdentifier" TEXT NOT NULL,
    "hasCategoryDLicense" BOOLEAN NOT NULL DEFAULT false,
    "hasDriverCard" BOOLEAN NOT NULL DEFAULT false,
    "hasValidFimo" BOOLEAN NOT NULL DEFAULT false,
    "hasTachographCard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IneoDriverProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IneoDriverProfile_driverIdentifier_key" ON "IneoDriverProfile"("driverIdentifier");
CREATE INDEX "IneoDriverProfile_hasCategoryDLicense_idx" ON "IneoDriverProfile"("hasCategoryDLicense");