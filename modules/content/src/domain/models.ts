export type ContentFieldType =
  | "TEXT"
  | "RICH_TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "JSON"
  | "RELATION";

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

export interface ContentTypeModel {
  id: string;
  name: string;
  apiId: string;
  description: string | null;
  fields: ContentFieldDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EntryRelationInput {
  fieldKey: string;
  targetEntryId: string;
}

export interface ContentEntryModel {
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
  scheduledPublishAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  currentRevision: number;
  relations: Array<{ fieldKey: string; targetEntryId: string }>;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentRevisionModel {
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
  scheduledPublishAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}
