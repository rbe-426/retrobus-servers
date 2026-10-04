CREATE TABLE "DiscordGuild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "ownerId" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordGuild_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscordGuildChannel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DiscordGuildChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscordGuildRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#000000',
    "position" INTEGER NOT NULL DEFAULT 0,
    "managed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DiscordGuildRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Bot920GuildSettings" (
    "guildId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot920GuildSettings_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "Bot920PanelAuditEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bot920PanelAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscordGuild_lastSyncedAt_idx" ON "DiscordGuild"("lastSyncedAt");
CREATE INDEX "DiscordGuildChannel_guildId_position_idx" ON "DiscordGuildChannel"("guildId", "position");
CREATE INDEX "DiscordGuildRole_guildId_position_idx" ON "DiscordGuildRole"("guildId", "position");
CREATE INDEX "Bot920PanelAuditEvent_guildId_createdAt_idx" ON "Bot920PanelAuditEvent"("guildId", "createdAt");

ALTER TABLE "DiscordGuildChannel" ADD CONSTRAINT "DiscordGuildChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordGuildRole" ADD CONSTRAINT "DiscordGuildRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bot920GuildSettings" ADD CONSTRAINT "Bot920GuildSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bot920PanelAuditEvent" ADD CONSTRAINT "Bot920PanelAuditEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;