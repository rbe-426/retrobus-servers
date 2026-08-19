CREATE TABLE "retromail_settings" (
    "userId" TEXT NOT NULL,
    "signature" TEXT,
    "profilePhoto" TEXT,
    "mailFont" TEXT DEFAULT 'Arial',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retromail_settings_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "retromail_settings_updatedAt_idx" ON "retromail_settings"("updatedAt");