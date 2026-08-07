import type {
  ContentEntryModel,
  ContentFieldDefinition,
  ContentRevisionModel,
  ContentTypeModel,
  EntryRelationInput,
  Page,
} from "../domain/models.js";

export interface ContentTypeInput {
  name: string;
  apiId: string;
  description?: string | null;
  fields: Array<Omit<ContentFieldDefinition, "id">>;
}

export interface ContentTypeUpdateInput {
  name?: string;
  description?: string | null;
  fields?: Array<Omit<ContentFieldDefinition, "id">>;
}

export interface EntryInput {
  contentTypeId: string;
  slug: string;
  locale: string;
  data: Record<string, unknown>;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoMetadata?: Record<string, unknown> | null;
  relations?: EntryRelationInput[];
}

export interface EntryUpdateInput {
  slug?: string;
  locale?: string;
  data?: Record<string, unknown>;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoMetadata?: Record<string, unknown> | null;
  relations?: EntryRelationInput[];
}

export interface EntryListInput {
  page: number;
  pageSize: number;
  contentTypeId?: string;
  locale?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  search?: string;
}

export interface ContentRepository {
  listContentTypes(): Promise<ContentTypeModel[]>;
  getContentType(id: string): Promise<ContentTypeModel | null>;
  getContentTypeByApiId(apiId: string): Promise<ContentTypeModel | null>;
  createContentType(input: ContentTypeInput): Promise<ContentTypeModel>;
  updateContentType(id: string, input: ContentTypeUpdateInput): Promise<ContentTypeModel>;
  deleteContentType(id: string): Promise<void>;
  countEntriesForType(contentTypeId: string): Promise<number>;
  entriesExist(ids: readonly string[]): Promise<boolean>;

  listEntries(input: EntryListInput): Promise<Page<ContentEntryModel>>;
  getEntry(id: string): Promise<ContentEntryModel | null>;
  getPublishedEntry(apiId: string, slug: string, locale: string): Promise<ContentEntryModel | null>;
  listPublishedEntries(apiId: string, locale: string, page: number, pageSize: number): Promise<Page<ContentEntryModel>>;
  createEntry(input: EntryInput, actorId: string | null): Promise<ContentEntryModel>;
  updateEntry(id: string, input: EntryUpdateInput, actorId: string | null): Promise<ContentEntryModel>;
  setEntryStatus(
    id: string,
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
    actorId: string | null,
    options?: { scheduledPublishAt?: Date | null },
  ): Promise<ContentEntryModel>;
  deleteEntry(id: string): Promise<void>;
  listRevisions(entryId: string): Promise<ContentRevisionModel[]>;
  listDueScheduled(now: Date, limit: number): Promise<ContentEntryModel[]>;
  writeAudit(input: {
    actorUserId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}
