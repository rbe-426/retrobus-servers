CREATE TABLE "DiscordGuildModeratorRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscordGuildModeratorRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscordGuildModeratorRole_guildId_roleId_key" ON "DiscordGuildModeratorRole"("guildId", "roleId");
CREATE INDEX "DiscordGuildModeratorRole_guildId_idx" ON "DiscordGuildModeratorRole"("guildId");
ALTER TABLE "DiscordGuildModeratorRole" ADD CONSTRAINT "DiscordGuildModeratorRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;