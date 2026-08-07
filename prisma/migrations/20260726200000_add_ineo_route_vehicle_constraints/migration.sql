ALTER TABLE "IneoRoute"
ADD COLUMN "vehicleParc" TEXT,
ADD COLUMN "vehicleConstraints" JSONB;

CREATE INDEX "IneoRoute_vehicleParc_idx" ON "IneoRoute"("vehicleParc");