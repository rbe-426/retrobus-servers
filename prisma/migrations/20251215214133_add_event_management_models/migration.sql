-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ticketType" TEXT NOT NULL DEFAULT 'adult',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departurePoint" TEXT,
    "arrivalPoint" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 50,
    "occupancy" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planification" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "places" INTEGER NOT NULL DEFAULT 0,
    "confirmed" INTEGER NOT NULL DEFAULT 0,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpsTracking" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GpsTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "eventId" TEXT,
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Participant_eventId_idx" ON "Participant"("eventId");

-- CreateIndex
CREATE INDEX "Participant_email_idx" ON "Participant"("email");

-- CreateIndex
CREATE INDEX "Route_eventId_idx" ON "Route"("eventId");

-- CreateIndex
CREATE INDEX "Planification_date_idx" ON "Planification"("date");

-- CreateIndex
CREATE INDEX "Planification_eventId_idx" ON "Planification"("eventId");

-- CreateIndex
CREATE INDEX "GpsTracking_vehicleId_idx" ON "GpsTracking"("vehicleId");

-- CreateIndex
CREATE INDEX "GpsTracking_timestamp_idx" ON "GpsTracking"("timestamp");

-- CreateIndex
CREATE INDEX "Transaction_eventId_idx" ON "Transaction"("eventId");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_category_idx" ON "Transaction"("category");
