-- Portefeuilles clients et fiches clients, rattachables aux devis et factures.
CREATE TABLE "FinancePortfolio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePortfolio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "type" TEXT NOT NULL DEFAULT 'ENTREPRISE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "portfolioId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "siret" TEXT,
    "vatNumber" TEXT,
    "paymentTerms" TEXT,
    "contacts" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceClient_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "financial_documents" ADD COLUMN "clientId" TEXT;

CREATE INDEX "FinancePortfolio_name_idx" ON "FinancePortfolio"("name");
CREATE INDEX "FinanceClient_name_idx" ON "FinanceClient"("name");
CREATE INDEX "FinanceClient_portfolioId_idx" ON "FinanceClient"("portfolioId");
CREATE INDEX "FinanceClient_status_idx" ON "FinanceClient"("status");
CREATE INDEX "financial_documents_clientId_idx" ON "financial_documents"("clientId");
