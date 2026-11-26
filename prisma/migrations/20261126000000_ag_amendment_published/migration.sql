-- Brouillon d'instruction : une décision n'est visible des adhérents qu'une fois publiée.
ALTER TABLE "AgAmendment" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
UPDATE "AgAmendment" SET "published" = true WHERE "status" IN ('ADOPTED', 'REJECTED', 'NOT_ADOPTED');
