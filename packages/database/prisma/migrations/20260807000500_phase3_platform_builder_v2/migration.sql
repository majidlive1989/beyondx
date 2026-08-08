-- Phase 3 Platform Builder v2: reusable components, dynamic zones and UID/rich-text fields
ALTER TYPE "DataSchemaKind" ADD VALUE IF NOT EXISTS 'COMPONENT';
ALTER TYPE "DataFieldType" ADD VALUE IF NOT EXISTS 'RICH_TEXT';
ALTER TYPE "DataFieldType" ADD VALUE IF NOT EXISTS 'UID';
ALTER TYPE "DataFieldType" ADD VALUE IF NOT EXISTS 'COMPONENT';
ALTER TYPE "DataFieldType" ADD VALUE IF NOT EXISTS 'DYNAMIC_ZONE';
