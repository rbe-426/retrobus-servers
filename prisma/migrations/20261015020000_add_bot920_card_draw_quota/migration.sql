CREATE TABLE "DiscordCardDrawQuota" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiscordCardDrawQuota_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscordCardDrawQuota_guildId_userId_key" ON "DiscordCardDrawQuota"("guildId", "userId");
CREATE INDEX "DiscordCardDrawQuota_resetAt_idx" ON "DiscordCardDrawQuota"("resetAt");
ALTER TABLE "DiscordCardDrawQuota" ADD CONSTRAINT "DiscordCardDrawQuota_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;