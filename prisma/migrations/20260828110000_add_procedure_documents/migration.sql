CREATE TABLE "ProcedureDocument" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcedureDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcedureDocument_categoryId_uploadedAt_idx" ON "ProcedureDocument"("categoryId", "uploadedAt");