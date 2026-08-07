CREATE TYPE "ContentFieldType" AS ENUM ('TEXT', 'RICH_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'JSON', 'RELATION');
CREATE TYPE "ContentEntryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "content_types" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "apiId" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_definitions" (
  "id" TEXT NOT NULL,
  "contentTypeId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "ContentFieldType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "localized" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "validation" JSONB,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_entries" (
  "id" TEXT NOT NULL,
  "contentTypeId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "status" "ContentEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "data" JSONB NOT NULL,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "seoMetadata" JSONB,
  "scheduledPublishAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "currentRevision" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_revisions" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "slug" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "status" "ContentEntryStatus" NOT NULL,
  "data" JSONB NOT NULL,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "seoMetadata" JSONB,
  "scheduledPublishAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entry_relations" (
  "id" TEXT NOT NULL,
  "sourceEntryId" TEXT NOT NULL,
  "targetEntryId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entry_relations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_types_apiId_key" ON "content_types"("apiId");
CREATE INDEX "content_types_name_idx" ON "content_types"("name");
CREATE UNIQUE INDEX "field_definitions_contentTypeId_key_key" ON "field_definitions"("contentTypeId", "key");
CREATE INDEX "field_definitions_contentTypeId_position_idx" ON "field_definitions"("contentTypeId", "position");
CREATE UNIQUE INDEX "content_entries_contentTypeId_locale_slug_key" ON "content_entries"("contentTypeId", "locale", "slug");
CREATE INDEX "content_entries_contentTypeId_status_locale_idx" ON "content_entries"("contentTypeId", "status", "locale");
CREATE INDEX "content_entries_status_scheduledPublishAt_idx" ON "content_entries"("status", "scheduledPublishAt");
CREATE INDEX "content_entries_updatedAt_idx" ON "content_entries"("updatedAt");
CREATE UNIQUE INDEX "content_revisions_entryId_revision_key" ON "content_revisions"("entryId", "revision");
CREATE INDEX "content_revisions_entryId_createdAt_idx" ON "content_revisions"("entryId", "createdAt");
CREATE UNIQUE INDEX "entry_relations_sourceEntryId_fieldKey_targetEntryId_key" ON "entry_relations"("sourceEntryId", "fieldKey", "targetEntryId");
CREATE INDEX "entry_relations_targetEntryId_idx" ON "entry_relations"("targetEntryId");
CREATE INDEX "entry_relations_sourceEntryId_fieldKey_idx" ON "entry_relations"("sourceEntryId", "fieldKey");

ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "content_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "content_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "content_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entry_relations" ADD CONSTRAINT "entry_relations_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "content_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entry_relations" ADD CONSTRAINT "entry_relations_targetEntryId_fkey" FOREIGN KEY ("targetEntryId") REFERENCES "content_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
