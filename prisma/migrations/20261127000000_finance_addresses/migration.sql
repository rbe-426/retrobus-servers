-- Carnet d'adresses partagé pour les calculateurs de trajet (devis, notes de frais).
CREATE TABLE "FinanceAddress" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceAddress_name_idx" ON "FinanceAddress"("name");
