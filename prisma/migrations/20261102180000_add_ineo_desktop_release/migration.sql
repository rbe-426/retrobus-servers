-- CreateTable
CREATE TABLE "IneoDesktopRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "notes" TEXT,
    "data" BYTEA NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IneoDesktopRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IneoDesktopRelease_version_key" ON "IneoDesktopRelease"("version");

-- CreateIndex
CREATE INDEX "IneoDesktopRelease_createdAt_idx" ON "IneoDesktopRelease"("createdAt");
