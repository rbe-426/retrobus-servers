CREATE TABLE "PublicNews" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "media" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "author" TEXT,
    "createdBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicNews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicNews_slug_key" ON "PublicNews"("slug");
CREATE INDEX "PublicNews_featured_idx" ON "PublicNews"("featured");
CREATE INDEX "PublicNews_published_idx" ON "PublicNews"("published");
CREATE INDEX "PublicNews_publishedAt_idx" ON "PublicNews"("publishedAt");

-- Preserve externally published articles created before PublicNews existed.
-- Their existing identifiers remain their public slugs to keep old URLs valid.
INSERT INTO "PublicNews" (
    "id", "slug", "title", "excerpt", "content", "imageUrl", "media",
    "featured", "published", "author", "createdBy", "publishedAt", "createdAt", "updatedAt"
)
SELECT
    "id", "id", "title", "excerpt", "content", "imageUrl", "media",
    "featured", "published", "author", "createdBy", "publishedAt", "createdAt", "updatedAt"
FROM "RetroNews"
WHERE "showOnExternal" = true
ON CONFLICT ("id") DO NOTHING;
