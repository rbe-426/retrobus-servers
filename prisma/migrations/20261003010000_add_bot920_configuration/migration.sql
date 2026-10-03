CREATE TABLE "Bot920Configuration" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot920Configuration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Bot920ConfigurationAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bot920ConfigurationAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Bot920ConfigurationAudit_createdAt_idx" ON "Bot920ConfigurationAudit"("createdAt");