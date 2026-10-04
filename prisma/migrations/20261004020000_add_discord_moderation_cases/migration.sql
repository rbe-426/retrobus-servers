CREATE TABLE "DiscordModerationCase" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetTag" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "moderatorTag" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'COMMAND',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DiscordModerationCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscordModerationCase_guildId_createdAt_idx" ON "DiscordModerationCase"("guildId", "createdAt");
CREATE INDEX "DiscordModerationCase_guildId_targetUserId_createdAt_idx" ON "DiscordModerationCase"("guildId", "targetUserId", "createdAt");
CREATE INDEX "DiscordModerationCase_expiresAt_status_idx" ON "DiscordModerationCase"("expiresAt", "status");

ALTER TABLE "DiscordModerationCase" ADD CONSTRAINT "DiscordModerationCase_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;