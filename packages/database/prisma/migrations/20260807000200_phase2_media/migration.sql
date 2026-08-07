CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'FILE');

CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "title" TEXT,
    "metadata" JSONB,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");
CREATE INDEX "media_assets_kind_createdAt_idx" ON "media_assets"("kind", "createdAt");
CREATE INDEX "media_assets_mimeType_idx" ON "media_assets"("mimeType");
CREATE INDEX "media_assets_uploadedByUserId_createdAt_idx" ON "media_assets"("uploadedByUserId", "createdAt");

ALTER TABLE "media_assets"
ADD CONSTRAINT "media_assets_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
