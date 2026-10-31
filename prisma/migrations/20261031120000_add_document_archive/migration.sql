-- AlterTable
ALTER TABLE "financial_documents" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "financial_documents" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "financial_documents_archived_idx" ON "financial_documents"("archived");
