-- Refonte lignes / itinéraires : les anciens trajets avec code course sont supprimés (décision d'exploitation).
DELETE FROM "IneoRoute";

-- CreateTable
CREATE TABLE "IneoLine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#9F063A',
    "destination1" TEXT NOT NULL,
    "destination2" TEXT NOT NULL,
    "outboundStops" JSONB,
    "outboundPath" JSONB,
    "returnStops" JSONB,
    "returnPath" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IneoLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IneoLine_name_key" ON "IneoLine"("name");

-- AlterTable
ALTER TABLE "IneoMission" ADD COLUMN "courses" JSONB,
ADD COLUMN "courseIndex" INTEGER NOT NULL DEFAULT 0;
