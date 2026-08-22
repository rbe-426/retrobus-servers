-- CreateTable
CREATE TABLE "MuseeAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuseeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeStaffCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "ipAddress" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuseeStaffCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeStockItem" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "categorie" TEXT NOT NULL DEFAULT 'Pièce mécanique',
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "etat" TEXT NOT NULL DEFAULT 'Bon',
    "emplacement" TEXT,
    "fournisseur" TEXT,
    "dateEntree" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeRestoration" (
    "id" TEXT NOT NULL,
    "vehicleParc" TEXT NOT NULL,
    "responsable" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avancement" INTEGER NOT NULL DEFAULT 0,
    "taches" JSONB,
    "budget" DOUBLE PRECISION,
    "depenses" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeRestoration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeDocumentation" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Manuel',
    "annee" INTEGER,
    "auteur" TEXT,
    "pages" INTEGER,
    "emplacement" TEXT,
    "numerise" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeDocumentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeStaff" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "nom" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "competences" JSONB,
    "disponibilite" TEXT,
    "telephone" TEXT,
    "adhesion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseePlanning" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "zone" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "horaire" TEXT,
    "tache" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseePlanning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeFloor" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "salles" INTEGER,
    "capacite" INTEGER,
    "superficie" TEXT,
    "theme" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeFacingZone" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "pieces" INTEGER NOT NULL DEFAULT 0,
    "rotation" TEXT,
    "derniereMAJ" TIMESTAMP(3),
    "priorite" TEXT NOT NULL DEFAULT 'Moyenne',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeFacingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeReservation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nbPersonnes" INTEGER NOT NULL,
    "motif" TEXT NOT NULL DEFAULT 'Visite libre',
    "dateReservation" TIMESTAMP(3) NOT NULL,
    "creneauSouhaite" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'CONFIRMEE',
    "commentaire" TEXT,
    "paiementEffectue" BOOLEAN NOT NULL DEFAULT false,
    "montantTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modePaiement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeVisit" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "nom" TEXT NOT NULL,
    "nbPersonnes" INTEGER NOT NULL,
    "motif" TEXT NOT NULL DEFAULT 'Visite libre',
    "ticketTypeId" TEXT,
    "ticketLabel" TEXT,
    "reductionId" TEXT,
    "exemptionId" TEXT,
    "montantPaye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modePaiement" TEXT,
    "paiementEffectue" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeTicketType" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeTicketType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeDiscount" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "pourcentage" INTEGER NOT NULL,
    "justificatif" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeExemption" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "justificatif" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuseeExemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseeShopItem" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" TEXT,
    "prix" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseeShopItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseePayment" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "modePaiement" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ENCAISSE',
    "reference" TEXT,
    "encaisseLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encaissePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuseePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MuseeAuditLog_action_idx" ON "MuseeAuditLog"("action");

-- CreateIndex
CREATE INDEX "MuseeAuditLog_entity_entityId_idx" ON "MuseeAuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "MuseeStaffCheckIn_userId_idx" ON "MuseeStaffCheckIn"("userId");

-- CreateIndex
CREATE INDEX "MuseeStaffCheckIn_checkedInAt_idx" ON "MuseeStaffCheckIn"("checkedInAt");

-- CreateIndex
CREATE UNIQUE INDEX "MuseeStockItem_ref_key" ON "MuseeStockItem"("ref");

-- CreateIndex
CREATE INDEX "MuseeStockItem_categorie_idx" ON "MuseeStockItem"("categorie");

-- CreateIndex
CREATE INDEX "MuseeStockItem_quantite_idx" ON "MuseeStockItem"("quantite");

-- CreateIndex
CREATE INDEX "MuseeRestoration_vehicleParc_idx" ON "MuseeRestoration"("vehicleParc");

-- CreateIndex
CREATE INDEX "MuseeRestoration_dateDebut_idx" ON "MuseeRestoration"("dateDebut");

-- CreateIndex
CREATE INDEX "MuseeDocumentation_type_idx" ON "MuseeDocumentation"("type");

-- CreateIndex
CREATE INDEX "MuseeDocumentation_annee_idx" ON "MuseeDocumentation"("annee");

-- CreateIndex
CREATE UNIQUE INDEX "MuseeStaff_memberId_key" ON "MuseeStaff"("memberId");

-- CreateIndex
CREATE INDEX "MuseeStaff_role_idx" ON "MuseeStaff"("role");

-- CreateIndex
CREATE INDEX "MuseePlanning_staffId_idx" ON "MuseePlanning"("staffId");

-- CreateIndex
CREATE INDEX "MuseePlanning_date_idx" ON "MuseePlanning"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MuseeFloor_nom_key" ON "MuseeFloor"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "MuseeFacingZone_nom_key" ON "MuseeFacingZone"("nom");

-- CreateIndex
CREATE INDEX "MuseeFacingZone_priorite_idx" ON "MuseeFacingZone"("priorite");

-- CreateIndex
CREATE INDEX "MuseeReservation_dateReservation_idx" ON "MuseeReservation"("dateReservation");

-- CreateIndex
CREATE INDEX "MuseeReservation_statut_idx" ON "MuseeReservation"("statut");

-- CreateIndex
CREATE INDEX "MuseeVisit_checkedInAt_idx" ON "MuseeVisit"("checkedInAt");

-- CreateIndex
CREATE INDEX "MuseeVisit_reservationId_idx" ON "MuseeVisit"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "MuseeTicketType_nom_key" ON "MuseeTicketType"("nom");

-- CreateIndex
CREATE INDEX "MuseeTicketType_actif_idx" ON "MuseeTicketType"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "MuseeDiscount_nom_key" ON "MuseeDiscount"("nom");

-- CreateIndex
CREATE INDEX "MuseeDiscount_actif_idx" ON "MuseeDiscount"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "MuseeExemption_nom_key" ON "MuseeExemption"("nom");

-- CreateIndex
CREATE INDEX "MuseeExemption_actif_idx" ON "MuseeExemption"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "MuseeShopItem_nom_key" ON "MuseeShopItem"("nom");

-- CreateIndex
CREATE INDEX "MuseeShopItem_actif_idx" ON "MuseeShopItem"("actif");

-- CreateIndex
CREATE INDEX "MuseeShopItem_stock_idx" ON "MuseeShopItem"("stock");

-- CreateIndex
CREATE INDEX "MuseePayment_sourceType_sourceId_idx" ON "MuseePayment"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "MuseePayment_encaisseLe_idx" ON "MuseePayment"("encaisseLe");

-- AddForeignKey
ALTER TABLE "MuseeRestoration" ADD CONSTRAINT "MuseeRestoration_vehicleParc_fkey" FOREIGN KEY ("vehicleParc") REFERENCES "Vehicle"("parc") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseePlanning" ADD CONSTRAINT "MuseePlanning_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "MuseeStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
