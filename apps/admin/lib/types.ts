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
