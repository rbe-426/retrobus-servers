CREATE TABLE "discord_birthdays" (
  "id" TEXT NOT NULL,
  "guild_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "birth_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "discord_birthdays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "discord_birthdays_guild_id_user_id_key" ON "discord_birthdays"("guild_id", "user_id");
CREATE INDEX "discord_birthdays_guild_id_birth_date_idx" ON "discord_birthdays"("guild_id", "birth_date");