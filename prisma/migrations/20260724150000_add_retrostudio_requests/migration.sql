CREATE TABLE "RetroStudioRequest" (
    "id" TEXT NOT NULL,
    "contactDate" TIMESTAMP(3) NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactRole" TEXT NOT NULL,
    "productionCompany" TEXT NOT NULL,
    "audiovisualProject" TEXT NOT NULL,
    "shootDate" TIMESTAMP(3) NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "validationRequired" BOOLEAN NOT NULL DEFAULT false,
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validationComment" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetroStudioRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RetroStudioRequest_status_idx" ON "RetroStudioRequest"("status");
CREATE INDEX "RetroStudioRequest_shootDate_idx" ON "RetroStudioRequest"("shootDate");
CREATE INDEX "RetroStudioRequest_validationRequired_idx" ON "RetroStudioRequest"("validationRequired");