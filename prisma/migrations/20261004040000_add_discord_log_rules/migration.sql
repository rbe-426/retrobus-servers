CREATE TABLE "DiscordLogRule" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordLogRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscordLogEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetTag" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "moderatorTag" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordLogEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscordLogRule_guildId_type_key" ON "DiscordLogRule"("guildId", "type");
CREATE INDEX "DiscordLogRule_guildId_enabled_idx" ON "DiscordLogRule"("guildId", "enabled");
CREATE INDEX "DiscordLogEvent_guildId_createdAt_idx" ON "DiscordLogEvent"("guildId", "createdAt");
CREATE INDEX "DiscordLogEvent_guildId_eventType_createdAt_idx" ON "DiscordLogEvent"("guildId", "eventType", "createdAt");

ALTER TABLE "DiscordLogRule" ADD CONSTRAINT "DiscordLogRule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordLogEvent" ADD CONSTRAINT "DiscordLogEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;