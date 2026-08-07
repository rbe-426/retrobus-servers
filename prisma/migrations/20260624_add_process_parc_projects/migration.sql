-- CreateTable
CREATE TABLE "ProcessParcProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalFleetNumber" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'pre_project',
    "tcInfos" JSONB,
    "documents" JSONB NOT NULL DEFAULT '[]',
    "mailCaptures" JSONB NOT NULL DEFAULT '[]',
    "reminders" JSONB NOT NULL DEFAULT '[]',
    "repatriementReports" JSONB NOT NULL DEFAULT '[]',
    "movedToOverviewAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessParcProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessParcProject_status_idx" ON "ProcessParcProject"("status");

-- CreateIndex
CREATE INDEX "ProcessParcProject_internalFleetNumber_idx" ON "ProcessParcProject"("internalFleetNumber");

-- CreateIndex
CREATE INDEX "ProcessParcProject_createdAt_idx" ON "ProcessParcProject"("createdAt");
