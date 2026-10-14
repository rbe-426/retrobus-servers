CREATE TABLE "DiscordMemberActivity" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscordMemberActivity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscordMemberActivity_guildId_userId_key" ON "DiscordMemberActivity"("guildId", "userId");
CREATE INDEX "DiscordMemberActivity_guildId_points_idx" ON "DiscordMemberActivity"("guildId", "points");
CREATE INDEX "DiscordMemberActivity_guildId_lastActiveAt_idx" ON "DiscordMemberActivity"("guildId", "lastActiveAt");
ALTER TABLE "DiscordMemberActivity" ADD CONSTRAINT "DiscordMemberActivity_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DiscordPoll" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "endsAt" TIMESTAMP(3),
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscordPoll_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DiscordPollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    CONSTRAINT "DiscordPollOption_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DiscordPollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscordPollVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscordPollOption_pollId_index_key" ON "DiscordPollOption"("pollId", "index");
CREATE UNIQUE INDEX "DiscordPollVote_pollId_userId_key" ON "DiscordPollVote"("pollId", "userId");
CREATE INDEX "DiscordPollVote_pollId_optionId_idx" ON "DiscordPollVote"("pollId", "optionId");
CREATE INDEX "DiscordPoll_guildId_status_createdAt_idx" ON "DiscordPoll"("guildId", "status", "createdAt");
ALTER TABLE "DiscordPoll" ADD CONSTRAINT "DiscordPoll_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordPollOption" ADD CONSTRAINT "DiscordPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "DiscordPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordPollVote" ADD CONSTRAINT "DiscordPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "DiscordPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordPollVote" ADD CONSTRAINT "DiscordPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "DiscordPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DiscordSuggestion" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscordSuggestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DiscordSuggestionVote" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscordSuggestionVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscordSuggestionVote_suggestionId_userId_key" ON "DiscordSuggestionVote"("suggestionId", "userId");
CREATE INDEX "DiscordSuggestionVote_suggestionId_idx" ON "DiscordSuggestionVote"("suggestionId");
CREATE INDEX "DiscordSuggestion_guildId_status_createdAt_idx" ON "DiscordSuggestion"("guildId", "status", "createdAt");
ALTER TABLE "DiscordSuggestion" ADD CONSTRAINT "DiscordSuggestion_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "DiscordGuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordSuggestionVote" ADD CONSTRAINT "DiscordSuggestionVote_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "DiscordSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;