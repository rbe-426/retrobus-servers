CREATE TABLE IF NOT EXISTS "VehicleLifecycleEvent" (
  "id" SERIAL PRIMARY KEY,
  "vehicleParc" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "severity" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "decision" TEXT,
  "immobilizing" BOOLEAN NOT NULL DEFAULT false,
  "reformReason" TEXT,
  "reformDate" TIMESTAMP(3),
  "decidedBy" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleLifecycleEvent_vehicleParc_fkey"
    FOREIGN KEY ("vehicleParc") REFERENCES "Vehicle"("parc") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VehicleLifecycleEvent_vehicleParc_idx" ON "VehicleLifecycleEvent"("vehicleParc");
CREATE INDEX IF NOT EXISTS "VehicleLifecycleEvent_eventType_idx" ON "VehicleLifecycleEvent"("eventType");
CREATE INDEX IF NOT EXISTS "VehicleLifecycleEvent_severity_idx" ON "VehicleLifecycleEvent"("severity");
CREATE INDEX IF NOT EXISTS "VehicleLifecycleEvent_createdAt_idx" ON "VehicleLifecycleEvent"("createdAt");
