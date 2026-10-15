CREATE TABLE "DiscordUserCard" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "firstAcquired" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAcquired" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscordUserCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscordUserCard_guildId_userId_cardId_key" ON "DiscordUserCard"("guildId", "userId", "cardId");
CREATE INDEX "DiscordUserCard_guildId_userId_rarity_idx" ON "DiscordUserCard"("guildId", "userId", "rarity");
CREATE INDEX "DiscordUserCard_guildId_userId_lastAcquired_idx" ON "DiscordUserCard"("guildId", "userId", "lastAcquired");
ALTER TABLE "DiscordUserCard" ADD CONSTRAINT "DiscordUserCard_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;