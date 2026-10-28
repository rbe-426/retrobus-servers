-- AlterTable
ALTER TABLE "financial_documents" ADD COLUMN "pricingData" TEXT;

-- CreateTable
CREATE TABLE "FinanceArticle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceArticle_category_idx" ON "FinanceArticle"("category");

-- CreateIndex
CREATE INDEX "FinanceArticle_isActive_idx" ON "FinanceArticle"("isActive");
