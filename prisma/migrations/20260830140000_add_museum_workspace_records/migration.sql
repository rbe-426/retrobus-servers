CREATE TABLE "MuseumWorkspaceRecord" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseumWorkspaceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MuseumWorkspaceRecord_section_updatedAt_idx" ON "MuseumWorkspaceRecord"("section", "updatedAt");