ALTER TABLE "RetroStudioRequest"
    ALTER COLUMN "contactDate" DROP NOT NULL,
    ALTER COLUMN "contactName" DROP NOT NULL,
    ALTER COLUMN "contactRole" DROP NOT NULL,
    ALTER COLUMN "productionCompany" DROP NOT NULL,
    ALTER COLUMN "audiovisualProject" DROP NOT NULL,
    ALTER COLUMN "shootDate" DROP NOT NULL,
    ALTER COLUMN "leadTimeDays" DROP NOT NULL;
