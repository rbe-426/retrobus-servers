ALTER TABLE "IneoRoute" ADD COLUMN "serviceReference" TEXT;

CREATE INDEX "IneoRoute_serviceReference_idx" ON "IneoRoute"("serviceReference");