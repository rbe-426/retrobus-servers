CREATE TABLE "DiscordGuildFeedback" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "DiscordGuildFeedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DiscordGuildFeedback_guildId_status_createdAt_idx" ON "DiscordGuildFeedback"("guildId", "status", "createdAt");
CREATE INDEX "DiscordGuildFeedback_guildId_type_createdAt_idx" ON "DiscordGuildFeedback"("guildId", "type", "createdAt");
CREATE INDEX "DiscordGuildFeedback_guildId_authorId_createdAt_idx" ON "DiscordGuildFeedback"("guildId", "authorId", "createdAt");
ALTER TABLE "DiscordGuildFeedback" ADD CONSTRAINT "DiscordGuildFeedback_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;