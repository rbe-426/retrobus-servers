-- AlterTable
ALTER TABLE "IneoUcDevice" ADD COLUMN "contentRevision" TEXT;

-- CreateTable
CREATE TABLE "IneoContentRevision" (
    "id" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IneoContentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IneoContentRevision_revision_key" ON "IneoContentRevision"("revision");

-- CreateIndex
CREATE INDEX "IneoContentRevision_createdAt_idx" ON "IneoContentRevision"("createdAt");
