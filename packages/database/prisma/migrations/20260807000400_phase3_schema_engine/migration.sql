-- Phase 3: Strapi-style schema engine and dynamic entity extensions
CREATE TYPE "DataSchemaKind" AS ENUM ('COLLECTION', 'SINGLE', 'SYSTEM_EXTENSION');
CREATE TYPE "DataFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'JSON', 'ENUM', 'MEDIA', 'RELATION');
CREATE TYPE "DataRecordStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "data_schemas" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pluralName" TEXT NOT NULL,
    "description" TEXT,
    "kind" "DataSchemaKind" NOT NULL,
    "publicRead" BOOLEAN NOT NULL DEFAULT false,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_schemas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_fields" (
    "id" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "DataFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "repeatable" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "validation" JSONB,
    "settings" JSONB,
    "relationTargetSchemaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_fields_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_records" (
    "id" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "status" "DataRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "values" JSONB NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entity_extensions" (
    "id" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "entity_extensions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "data_schemas_key_key" ON "data_schemas"("key");
CREATE INDEX "data_schemas_kind_displayName_idx" ON "data_schemas"("kind", "displayName");
CREATE UNIQUE INDEX "data_fields_schemaId_key_key" ON "data_fields"("schemaId", "key");
CREATE INDEX "data_fields_schemaId_position_idx" ON "data_fields"("schemaId", "position");
CREATE INDEX "data_fields_relationTargetSchemaId_idx" ON "data_fields"("relationTargetSchemaId");
CREATE INDEX "data_records_schemaId_status_updatedAt_idx" ON "data_records"("schemaId", "status", "updatedAt");
CREATE UNIQUE INDEX "entity_extensions_schemaId_targetType_targetId_key" ON "entity_extensions"("schemaId", "targetType", "targetId");
CREATE INDEX "entity_extensions_targetType_targetId_idx" ON "entity_extensions"("targetType", "targetId");

ALTER TABLE "data_fields" ADD CONSTRAINT "data_fields_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "data_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_records" ADD CONSTRAINT "data_records_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "data_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entity_extensions" ADD CONSTRAINT "entity_extensions_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "data_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
