ALTER TABLE "IneoMission" ADD COLUMN "courseReference" TEXT;

CREATE INDEX "IneoMission_courseReference_idx" ON "IneoMission"("courseReference");