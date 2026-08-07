import { AppError } from "@beyondx/core";
import type {
  ContentRepository,
  ContentTypeInput,
  ContentTypeUpdateInput,
  EntryInput,
  EntryListInput,
  EntryUpdateInput,
} from "./contracts.js";
import type {
  ContentEntryModel,
  ContentFieldDefinition,
  ContentRevisionModel,
  ContentTypeModel,
  EntryRelationInput,
  Page,
} from "../domain/models.js";

export interface ContentActionMetadata {
  actorId: string | null;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class ContentService {
  constructor(private readonly repository: ContentRepository) {}

  listContentTypes(): Promise<ContentTypeModel[]> {
    return this.repository.listContentTypes();
  }

  async getContentType(id: string): Promise<ContentTypeModel> {
    return requireContentType(await this.repository.getContentType(id));
  }

  async createContentType(input: ContentTypeInput, metadata: ContentActionMetadata): Promise<ContentTypeModel> {
    validateFieldDefinitions(input.fields);
    const existing = await this.repository.getContentTypeByApiId(input.apiId);
    if (existing) {
      throw new AppError({
        code: "CONTENT_TYPE_API_ID_CONFLICT",
        message: `Content type API ID is already in use: ${input.apiId}`,
        statusCode: 409,
      });
    }
    const created = await this.repository.createContentType(input);
    await this.audit(metadata, "content.type.created", "ContentType", created.id, { apiId: created.apiId });
    return created;
  }

  async updateContentType(id: string, input: ContentTypeUpdateInput, metadata: ContentActionMetadata): Promise<ContentTypeModel> {
    await this.getContentType(id);
    if (input.fields) validateFieldDefinitions(input.fields);
    const updated = await this.repository.updateContentType(id, input);
    await this.audit(metadata, "content.type.updated", "ContentType", id, { apiId: updated.apiId });
    return updated;
  }

  async deleteContentType(id: string, metadata: ContentActionMetadata): Promise<void> {
    const type = await this.getContentType(id);
    const entryCount = await this.repository.countEntriesForType(id);
    if (entryCount > 0) {
      throw new AppError({
        code: "CONTENT_TYPE_NOT_EMPTY",
        message: "Content types with entries cannot be deleted",
        statusCode: 409,
        details: { entryCount },
      });
    }
    await this.repository.deleteContentType(id);
    await this.audit(metadata, "content.type.deleted", "ContentType", id, { apiId: type.apiId });
  }

  listEntries(input: EntryListInput): Promise<Page<ContentEntryModel>> {
    return this.repository.listEntries(input);
  }

  async getEntry(id: string): Promise<ContentEntryModel> {
    const entry = await this.repository.getEntry(id);
    if (!entry) {
      throw new AppError({ code: "CONTENT_ENTRY_NOT_FOUND", message: "Content entry was not found", statusCode: 404 });
    }
    return entry;
  }

  async createEntry(input: EntryInput, metadata: ContentActionMetadata): Promise<ContentEntryModel> {
    const type = requireContentType(await this.repository.getContentType(input.contentTypeId));
    validateEntryData(type.fields, input.data);
    await this.validateRelations(type.fields, input.relations ?? []);
    const created = await this.repository.createEntry(input, metadata.actorId);
    await this.audit(metadata, "content.entry.created", "ContentEntry", created.id, {
      contentType: type.apiId,
      slug: created.slug,
      locale: created.locale,
    });
    return created;
  }

  async updateEntry(id: string, input: EntryUpdateInput, metadata: ContentActionMetadata): Promise<ContentEntryModel> {
    const existing = await this.getEntry(id);
    const type = requireContentType(await this.repository.getContentType(existing.contentTypeId));
    validateEntryData(type.fields, input.data ?? existing.data);
    if (input.relations) await this.validateRelations(type.fields, input.relations);
    const updated = await this.repository.updateEntry(id, input, metadata.actorId);
    await this.audit(metadata, "content.entry.updated", "ContentEntry", id, {
      revision: updated.currentRevision,
      slug: updated.slug,
      locale: updated.locale,
    });
    return updated;
  }

  async publishEntry(id: string, metadata: ContentActionMetadata): Promise<ContentEntryModel> {
    const existing = await this.getEntry(id);
    const type = requireContentType(await this.repository.getContentType(existing.contentTypeId));
    validateEntryData(type.fields, existing.data);
    await this.validateRelations(type.fields, existing.relations);
    const published = await this.repository.setEntryStatus(id, "PUBLISHED", metadata.actorId);
    await this.audit(metadata, "content.entry.published", "ContentEntry", id, { revision: published.currentRevision });
    return published;
  }

  async unpublishEntry(id: string, metadata: ContentActionMetadata): Promise<ContentEntryModel> {
    await this.getEntry(id);
    const draft = await this.repository.setEntryStatus(id, "DRAFT", metadata.actorId);
    await this.audit(metadata, "content.entry.unpublished", "ContentEntry", id, { revision: draft.currentRevision });
    return draft;
  }

  async archiveEntry(id: string, metadata: ContentActionMetadata): Promise<ContentEntryModel> {
    await this.getEntry(id);
    const archived = await this.repository.setEntryStatus(id, "ARCHIVED", metadata.actorId);
    await this.audit(metadata, "content.entry.archived", "ContentEntry", id, { revision: archived.currentRevision });
    return archived;
  }

  async scheduleEntry(id: string, scheduledPublishAt: Date | null, metadata: ContentActionMetadata): Promise<ContentEntryModel> {
    const existing = await this.getEntry(id);
    if (scheduledPublishAt && scheduledPublishAt.getTime() <= Date.now()) {
      throw new AppError({
        code: "CONTENT_SCHEDULE_IN_PAST",
        message: "Scheduled publication must be in the future",
        statusCode: 400,
      });
    }
    if (scheduledPublishAt) {
      const type = requireContentType(await this.repository.getContentType(existing.contentTypeId));
      validateEntryData(type.fields, existing.data);
      await this.validateRelations(type.fields, existing.relations);
    }
    const draft = await this.repository.setEntryStatus(id, "DRAFT", metadata.actorId, { scheduledPublishAt });
    await this.audit(metadata, scheduledPublishAt ? "content.entry.scheduled" : "content.entry.schedule_cleared", "ContentEntry", id, {
      scheduledPublishAt: scheduledPublishAt?.toISOString() ?? null,
    });
    return draft;
  }

  async deleteEntry(id: string, metadata: ContentActionMetadata): Promise<void> {
    const existing = await this.getEntry(id);
    await this.repository.deleteEntry(id);
    await this.audit(metadata, "content.entry.deleted", "ContentEntry", id, {
      slug: existing.slug,
      locale: existing.locale,
      contentType: existing.contentTypeApiId,
    });
  }

  async listRevisions(entryId: string): Promise<ContentRevisionModel[]> {
    await this.getEntry(entryId);
    return this.repository.listRevisions(entryId);
  }

  async getPublishedEntry(apiId: string, slug: string, locale: string): Promise<ContentEntryModel> {
    await this.processScheduledPublications();
    const entry = await this.repository.getPublishedEntry(apiId, slug, locale);
    if (!entry) {
      throw new AppError({ code: "CONTENT_PUBLIC_ENTRY_NOT_FOUND", message: "Published content was not found", statusCode: 404 });
    }
    return entry;
  }

  async listPublishedEntries(apiId: string, locale: string, page: number, pageSize: number): Promise<Page<ContentEntryModel>> {
    const type = await this.repository.getContentTypeByApiId(apiId);
    if (!type) {
      throw new AppError({ code: "CONTENT_TYPE_NOT_FOUND", message: "Content type was not found", statusCode: 404 });
    }
    await this.processScheduledPublications();
    return this.repository.listPublishedEntries(apiId, locale, page, pageSize);
  }

  async processScheduledPublications(): Promise<number> {
    const due = await this.repository.listDueScheduled(new Date(), 100);
    let published = 0;
    for (const entry of due) {
      try {
        const type = requireContentType(await this.repository.getContentType(entry.contentTypeId));
        validateEntryData(type.fields, entry.data);
        await this.validateRelations(type.fields, entry.relations);
        const result = await this.repository.setEntryStatus(entry.id, "PUBLISHED", null);
        await this.repository.writeAudit({
          actorUserId: null,
          action: "content.entry.scheduled_published",
          targetType: "ContentEntry",
          targetId: entry.id,
          metadata: { revision: result.currentRevision, scheduledPublishAt: entry.scheduledPublishAt?.toISOString() ?? null },
        });
        published += 1;
      } catch (error: unknown) {
        await this.repository.writeAudit({
          actorUserId: null,
          action: "content.entry.schedule_failed",
          targetType: "ContentEntry",
          targetId: entry.id,
          metadata: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }
    return published;
  }

  private async validateRelations(fields: ContentFieldDefinition[], relations: EntryRelationInput[]): Promise<void> {
    const relationKeys = new Set(fields.filter((field) => field.type === "RELATION").map((field) => field.key));
    const seen = new Set<string>();
    for (const relation of relations) {
      if (!relationKeys.has(relation.fieldKey)) {
        throw new AppError({
          code: "CONTENT_INVALID_RELATION_FIELD",
          message: `Field is not a relation field: ${relation.fieldKey}`,
          statusCode: 400,
        });
      }
      const uniqueKey = `${relation.fieldKey}:${relation.targetEntryId}`;
      if (seen.has(uniqueKey)) {
        throw new AppError({ code: "CONTENT_DUPLICATE_RELATION", message: "Duplicate content relation", statusCode: 400 });
      }
      seen.add(uniqueKey);
    }
    for (const field of fields.filter((candidate) => candidate.type === "RELATION" && candidate.required)) {
      if (!relations.some((relation) => relation.fieldKey === field.key)) {
        throw new AppError({ code: "CONTENT_REQUIRED_RELATION", message: `Required relation is missing: ${field.key}`, statusCode: 400 });
      }
    }
    if (!(await this.repository.entriesExist(relations.map((relation) => relation.targetEntryId)))) {
      throw new AppError({ code: "CONTENT_RELATION_TARGET_NOT_FOUND", message: "One or more related entries do not exist", statusCode: 400 });
    }
  }

  private audit(
    metadata: ContentActionMetadata,
    action: string,
    targetType: string,
    targetId: string | null,
    details?: Record<string, unknown>,
  ): Promise<void> {
    return this.repository.writeAudit({
      actorUserId: metadata.actorId,
      action,
      targetType,
      targetId,
      ...(metadata.requestId === undefined ? {} : { requestId: metadata.requestId }),
      ...(metadata.ipAddress === undefined ? {} : { ipAddress: metadata.ipAddress }),
      ...(metadata.userAgent === undefined ? {} : { userAgent: metadata.userAgent }),
      ...(details === undefined ? {} : { metadata: details }),
    });
  }
}

function requireContentType(type: ContentTypeModel | null): ContentTypeModel {
  if (!type) {
    throw new AppError({ code: "CONTENT_TYPE_NOT_FOUND", message: "Content type was not found", statusCode: 404 });
  }
  return type;
}

function validateFieldDefinitions(fields: Array<Omit<ContentFieldDefinition, "id">>): void {
  const keys = new Set<string>();
  for (const field of fields) {
    if (keys.has(field.key)) {
      throw new AppError({ code: "CONTENT_DUPLICATE_FIELD", message: `Duplicate field key: ${field.key}`, statusCode: 400 });
    }
    keys.add(field.key);
  }
}

function validateEntryData(fields: ContentFieldDefinition[], data: Record<string, unknown>): void {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  for (const key of Object.keys(data)) {
    if (!byKey.has(key)) {
      throw new AppError({ code: "CONTENT_UNKNOWN_FIELD", message: `Unknown content field: ${key}`, statusCode: 400 });
    }
  }
  for (const field of fields) {
    const value = data[field.key];
    if (field.type === "RELATION") {
      if (value !== undefined) {
        throw new AppError({ code: "CONTENT_RELATION_IN_DATA", message: `Relation field must use the relations payload: ${field.key}`, statusCode: 400 });
      }
      continue;
    }
    if (field.required && (value === undefined || value === null || value === "")) {
      throw new AppError({ code: "CONTENT_REQUIRED_FIELD", message: `Required content field is missing: ${field.key}`, statusCode: 400 });
    }
    if (value === undefined || value === null) continue;
    const valid =
      (field.type === "TEXT" && typeof value === "string") ||
      (field.type === "RICH_TEXT" && typeof value === "string") ||
      (field.type === "NUMBER" && typeof value === "number" && Number.isFinite(value)) ||
      (field.type === "BOOLEAN" && typeof value === "boolean") ||
      (field.type === "DATE" && typeof value === "string" && !Number.isNaN(Date.parse(value))) ||
      field.type === "JSON";
    if (!valid) {
      throw new AppError({ code: "CONTENT_FIELD_TYPE_MISMATCH", message: `Invalid value for field ${field.key} (${field.type})`, statusCode: 400 });
    }
    validateConfiguredRules(field, value);
  }
}

function validateConfiguredRules(field: ContentFieldDefinition, value: unknown): void {
  const rules = field.validation;
  if (!rules) return;
  if ((field.type === "TEXT" || field.type === "RICH_TEXT") && typeof value === "string") {
    const minLength = typeof rules.minLength === "number" ? rules.minLength : null;
    const maxLength = typeof rules.maxLength === "number" ? rules.maxLength : null;
    const pattern = typeof rules.pattern === "string" ? rules.pattern : null;
    if (minLength !== null && value.length < minLength) fieldValidationError(field, `must contain at least ${minLength} characters`);
    if (maxLength !== null && value.length > maxLength) fieldValidationError(field, `must contain at most ${maxLength} characters`);
    if (pattern !== null) {
      let expression: RegExp;
      try { expression = new RegExp(pattern); } catch {
        throw new AppError({ code: "CONTENT_INVALID_FIELD_RULE", message: `Invalid validation pattern configured for ${field.key}`, statusCode: 500 });
      }
      if (!expression.test(value)) fieldValidationError(field, "does not match the configured pattern");
    }
  }
  if (field.type === "NUMBER" && typeof value === "number") {
    const min = typeof rules.min === "number" ? rules.min : null;
    const max = typeof rules.max === "number" ? rules.max : null;
    if (min !== null && value < min) fieldValidationError(field, `must be greater than or equal to ${min}`);
    if (max !== null && value > max) fieldValidationError(field, `must be less than or equal to ${max}`);
  }
}

function fieldValidationError(field: ContentFieldDefinition, detail: string): never {
  throw new AppError({ code: "CONTENT_FIELD_VALIDATION_FAILED", message: `${field.label} ${detail}`, statusCode: 400, details: { field: field.key } });
}
