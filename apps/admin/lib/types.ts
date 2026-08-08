export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  emailVerified: boolean;
  lastLoginAt: string | null;
  roles: Array<{ id: string; name: string }>;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  system: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  description: string;
  module: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: "Bearer";
  user: AdminUser;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface AdminSession {
  id: string; userId: string; familyId: string; expiresAt: string; revokedAt: string | null; userAgent: string | null; ipAddress: string | null; lastUsedAt: string; createdAt: string;
}
export interface AuditLog {
  id: string; actorUserId: string | null; action: string; targetType: string; targetId: string | null; requestId: string | null; ipAddress: string | null; userAgent: string | null; metadata: Record<string, unknown> | null; createdAt: string;
}

export type ContentFieldType = "TEXT" | "RICH_TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "JSON" | "RELATION";
export type ContentEntryStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface ContentFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: ContentFieldType;
  required: boolean;
  localized: boolean;
  position: number;
  validation: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
}

export interface ContentType {
  id: string;
  name: string;
  apiId: string;
  description: string | null;
  fields: ContentFieldDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentRelation {
  fieldKey: string;
  targetEntryId: string;
}

export interface ContentEntry {
  id: string;
  contentTypeId: string;
  contentTypeApiId: string;
  slug: string;
  locale: string;
  status: ContentEntryStatus;
  data: Record<string, unknown>;
  seoTitle: string | null;
  seoDescription: string | null;
  seoMetadata: Record<string, unknown> | null;
  scheduledPublishAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  currentRevision: number;
  relations: ContentRelation[];
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentRevision {
  id: string;
  entryId: string;
  revision: number;
  slug: string;
  locale: string;
  status: ContentEntryStatus;
  data: Record<string, unknown>;
  seoTitle: string | null;
  seoDescription: string | null;
  seoMetadata: Record<string, unknown> | null;
  scheduledPublishAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface ContentFieldInput {
  key: string;
  label: string;
  type: ContentFieldType;
  required: boolean;
  localized: boolean;
  position: number;
  validation: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
}

export interface MediaAsset {
  id: string;
  originalName: string;
  fileName: string;
  storageProvider: string;
  mimeType: string;
  kind: "IMAGE" | "FILE";
  sizeBytes: number;
  checksumSha256: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  title: string | null;
  metadata: Record<string, unknown> | null;
  uploadedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CatalogProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type CatalogVariantStatus = "ACTIVE" | "DISABLED";

export interface CatalogBrand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogAttributeValue {
  id: string;
  attributeId: string;
  value: string;
  slug: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogAttribute {
  id: string;
  name: string;
  slug: string;
  position: number;
  values: CatalogAttributeValue[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogVariantAttributeSelection {
  attributeId: string;
  attributeName: string;
  attributeSlug: string;
  valueId: string;
  value: string;
  valueSlug: string;
}

export interface CatalogProductMedia {
  id: string;
  originalName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  title: string | null;
  position: number;
}

export interface CatalogProductVariant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  status: CatalogVariantStatus;
  position: number;
  attributes: CatalogVariantAttributeSelection[];
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: CatalogProductStatus;
  brandId: string | null;
  brand: CatalogBrand | null;
  categories: CatalogCategory[];
  media: CatalogProductMedia[];
  variants: CatalogProductVariant[];
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type DataSchemaKind = "COLLECTION" | "SINGLE" | "COMPONENT" | "SYSTEM_EXTENSION";
export type DataFieldType = "TEXT" | "LONG_TEXT" | "RICH_TEXT" | "UID" | "NUMBER" | "BOOLEAN" | "DATE" | "JSON" | "ENUM" | "MEDIA" | "RELATION" | "COMPONENT" | "DYNAMIC_ZONE";
export type DataRecordStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface DataFieldDefinition {
  id: string;
  schemaId: string;
  key: string;
  label: string;
  type: DataFieldType;
  required: boolean;
  repeatable: boolean;
  position: number;
  validation: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  relationTargetSchemaId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataSchemaDefinition {
  id: string;
  key: string;
  displayName: string;
  pluralName: string;
  description: string | null;
  kind: DataSchemaKind;
  publicRead: boolean;
  system: boolean;
  fields: DataFieldDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface DynamicDataRecord {
  id: string;
  schemaId: string;
  schemaKey: string;
  status: DataRecordStatus;
  values: Record<string, unknown>;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PluginAdminNavigationItem {
  group: string;
  href: string;
  label: string;
  permission?: string;
  exact?: boolean;
}

export interface PluginRuntimeState {
  id: string;
  packageName: string;
  displayName: string;
  version: string;
  description: string;
  installed: boolean;
  enabled: boolean;
  active: boolean;
  restartRequired: boolean;
  requiredModules: string[];
  pluginDependencies: string[];
  capabilities: string[];
  adminNavigation: PluginAdminNavigationItem[];
}
