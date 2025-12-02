-- AlterTable
ALTER TABLE "Member" ADD COLUMN "membershipType" TEXT DEFAULT 'STANDARD';
ALTER TABLE "Member" ADD COLUMN "permissions" TEXT;

-- CreateTable
CREATE TABLE "SiteUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "linkedMemberId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parc" TEXT NOT NULL,
    "marque" TEXT,
    "modele" TEXT,
    "etat" TEXT DEFAULT 'disponible',
    "fuel" INTEGER DEFAULT 0,
    "caracteristiques" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VehicleUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parc" TEXT NOT NULL,
    "conducteur" TEXT,
    "note" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME
);

-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parc" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "cost" REAL DEFAULT 0,
    "mileage" INTEGER,
    "performedBy" TEXT,
    "location" TEXT,
    "status" TEXT DEFAULT 'completed',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextDueDate" DATETIME
);

-- CreateTable
CREATE TABLE "VehicleServiceSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parc" TEXT NOT NULL,
    "serviceType" TEXT,
    "description" TEXT,
    "frequency" TEXT,
    "priority" TEXT DEFAULT 'normal',
    "status" TEXT DEFAULT 'pending',
    "plannedDate" DATETIME
);

-- CreateTable
CREATE TABLE "Flash" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "message" TEXT,
    "content" TEXT,
    "type" TEXT DEFAULT 'info',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT DEFAULT 'info',
    "message" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RetroNews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "body" TEXT,
    "content" TEXT,
    "excerpt" TEXT,
    "imageUrl" TEXT,
    "author" TEXT,
    "status" TEXT DEFAULT 'draft',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "extras" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("createdAt", "date", "description", "id", "status", "title", "updatedAt") SELECT "createdAt", "date", "description", "id", "status", "title", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SiteUser_email_key" ON "SiteUser"("email");

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_parc_key" ON "Vehicle"("parc");
