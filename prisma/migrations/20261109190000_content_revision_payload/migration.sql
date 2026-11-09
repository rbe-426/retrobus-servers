-- AlterTable
ALTER TABLE "IneoContentRevision" ADD COLUMN "payload" TEXT;

-- CreateTable
CREATE TABLE "IneoContentFile" (
    "id" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IneoContentFile_pkey" PRIMARY KEY ("id")
);
