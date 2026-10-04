CREATE TABLE "AutoModRule" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "action" TEXT NOT NULL DEFAULT 'TIMEOUT',
    "threshold" INTEGER,
    "windowSeconds" INTEGER,
    "timeoutMinutes" INTEGER,
    "alertChannelId" TEXT,
    "deleteMessage" BOOLEAN NOT NULL DEFAULT true,
    "notifyUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoModRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutoModException" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoModException_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutoModWord" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'PARTIAL',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "action" TEXT NOT NULL DEFAULT 'TIMEOUT',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoModWord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutoModRule_guildId_type_key" ON "AutoModRule"("guildId", "type");
CREATE INDEX "AutoModRule_guildId_enabled_idx" ON "AutoModRule"("guildId", "enabled");
CREATE UNIQUE INDEX "AutoModException_ruleId_entityType_entityId_key" ON "AutoModException"("ruleId", "entityType", "entityId");
CREATE INDEX "AutoModException_ruleId_idx" ON "AutoModException"("ruleId");
CREATE UNIQUE INDEX "AutoModWord_guildId_phrase_key" ON "AutoModWord"("guildId", "phrase");
CREATE INDEX "AutoModWord_guildId_enabled_idx" ON "AutoModWord"("guildId", "enabled");

ALTER TABLE "AutoModRule" ADD CONSTRAINT "AutoModRule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoModException" ADD CONSTRAINT "AutoModException_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutoModRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoModWord" ADD CONSTRAINT "AutoModWord_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;