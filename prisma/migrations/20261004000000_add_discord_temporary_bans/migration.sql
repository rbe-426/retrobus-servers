CREATE TABLE "discord_temporary_bans" (
  "id" TEXT NOT NULL,
  "guild_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "moderator_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "lifted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "discord_temporary_bans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "discord_temporary_bans_guild_id_user_id_lifted_at_key" ON "discord_temporary_bans"("guild_id", "user_id", "lifted_at");
CREATE INDEX "discord_temporary_bans_expires_at_lifted_at_idx" ON "discord_temporary_bans"("expires_at", "lifted_at");