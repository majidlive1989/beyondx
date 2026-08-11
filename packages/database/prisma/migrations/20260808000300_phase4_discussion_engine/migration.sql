CREATE TYPE "DiscussionSourceType" AS ENUM ('CONTENT', 'PRODUCT');
CREATE TYPE "DiscussionKind" AS ENUM ('COMMENT', 'REVIEW');
CREATE TYPE "DiscussionStatus" AS ENUM ('PENDING', 'APPROVED', 'SPAM', 'TRASH');

CREATE TABLE "discussion_settings" (
  "id" TEXT NOT NULL,
  "sourceType" "DiscussionSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "reviewsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "ratingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "verifiedPurchaseOnly" BOOLEAN NOT NULL DEFAULT false,
  "notifyOnNew" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "discussion_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "discussion_entries" (
  "id" TEXT NOT NULL,
  "sourceType" "DiscussionSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "kind" "DiscussionKind" NOT NULL,
  "status" "DiscussionStatus" NOT NULL DEFAULT 'PENDING',
  "parentId" TEXT,
  "authorUserId" TEXT,
  "authorName" TEXT NOT NULL,
  "authorEmail" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "rating" INTEGER,
  "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
  "moderatedAt" TIMESTAMP(3),
  "moderatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "discussion_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discussion_rating_valid" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5)),
  CONSTRAINT "discussion_review_rating_only" CHECK ("kind" = 'REVIEW' OR "rating" IS NULL)
);

CREATE UNIQUE INDEX "discussion_settings_sourceType_sourceId_key" ON "discussion_settings"("sourceType", "sourceId");
CREATE INDEX "discussion_entries_sourceType_sourceId_status_createdAt_idx" ON "discussion_entries"("sourceType", "sourceId", "status", "createdAt");
CREATE INDEX "discussion_entries_kind_status_createdAt_idx" ON "discussion_entries"("kind", "status", "createdAt");
CREATE INDEX "discussion_entries_status_createdAt_idx" ON "discussion_entries"("status", "createdAt");
CREATE INDEX "discussion_entries_parentId_idx" ON "discussion_entries"("parentId");

ALTER TABLE "discussion_entries"
  ADD CONSTRAINT "discussion_entries_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "discussion_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
