import { Prisma, type PrismaClient } from "@beyondx/database";
import type {
  ContentRepository,
  ContentTypeInput,
  ContentTypeUpdateInput,
  EntryInput,
  EntryListInput,
  EntryUpdateInput,
} from "../application/contracts.js";
import type {
  ContentEntryModel,
  ContentRevisionModel,
  ContentTypeModel,
  Page,
} from "../domain/models.js";

const contentTypeInclude = {
  fields: { orderBy: { position: "asc" as const } },
} satisfies Prisma.ContentTypeInclude;

const entryInclude = {
  contentType: { select: { apiId: true } },
  outgoingRelations: { select: { fieldKey: true, targetEntryId: true } },
} satisfies Prisma.ContentEntryInclude;

type ContentTypeRecord = Prisma.ContentTypeGetPayload<{ include: typeof contentTypeInclude }>;
type EntryRecord = Prisma.ContentEntryGetPayload<{ include: typeof entryInclude }>;

export class PrismaContentRepository implements ContentRepository {
  constructor(private readonly database: PrismaClient) {}

  async listContentTypes(): Promise<ContentTypeModel[]> {
    const records = await this.database.contentType.findMany({
      include: contentTypeInclude,
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
    return records.map(toContentType);
  }

  async getContentType(id: string): Promise<ContentTypeModel | null> {
    const record = await this.database.contentType.findUnique({
      where: { id },
      include: contentTypeInclude,
    });
    return record ? toContentType(record) : null;
  }

  async getContentTypeByApiId(apiId: string): Promise<ContentTypeModel | null> {
    const record = await this.database.contentType.findUnique({
      where: { apiId },
      include: contentTypeInclude,
    });
    return record ? toContentType(record) : null;
  }

  async createContentType(input: ContentTypeInput): Promise<ContentTypeModel> {
    const record = await this.database.contentType.create({
      data: {
        name: input.name,
        apiId: input.apiId,
        ...(input.description === undefined ? {} : { description: input.description }),
        fields: {
          create: input.fields.map((field) => ({
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            localized: field.localized,
            position: field.position,
            ...(field.validation === null
              ? {}
              : { validation: field.validation as Prisma.InputJsonValue }),
            ...(field.settings === null
              ? {}
              : { settings: field.settings as Prisma.InputJsonValue }),
          })),
        },
      },
      include: contentTypeInclude,
    });
    return toContentType(record);
  }

  async updateContentType(id: string, input: ContentTypeUpdateInput): Promise<ContentTypeModel> {
    await this.database.$transaction(async (transaction) => {
      await transaction.contentType.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined ? {} : { description: input.description }),
        },
      });
      if (input.fields) {
        await transaction.fieldDefinition.deleteMany({ where: { contentTypeId: id } });
        if (input.fields.length > 0) {
          await transaction.fieldDefinition.createMany({
            data: input.fields.map((field) => ({
              contentTypeId: id,
              key: field.key,
              label: field.label,
              type: field.type,
              required: field.required,
              localized: field.localized,
              position: field.position,
              ...(field.validation === null
                ? {}
                : { validation: field.validation as Prisma.InputJsonValue }),
              ...(field.settings === null
                ? {}
                : { settings: field.settings as Prisma.InputJsonValue }),
            })),
          });
        }
      }
    });
    const updated = await this.getContentType(id);
    if (!updated) throw new Error("Content type disappeared after update");
    return updated;
  }

  async deleteContentType(id: string): Promise<void> {
    await this.database.contentType.delete({ where: { id } });
  }

  countEntriesForType(contentTypeId: string): Promise<number> {
    return this.database.contentEntry.count({ where: { contentTypeId } });
  }

  async entriesExist(ids: readonly string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const uniqueIds = [...new Set(ids)];
    const count = await this.database.contentEntry.count({ where: { id: { in: uniqueIds } } });
    return count === uniqueIds.length;
  }

  async listEntries(input: EntryListInput): Promise<Page<ContentEntryModel>> {
    const where: Prisma.ContentEntryWhereInput = {
      ...(input.contentTypeId === undefined ? {} : { contentTypeId: input.contentTypeId }),
      ...(input.locale === undefined ? {} : { locale: input.locale }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.search === undefined
        ? {}
        : {
            OR: [
              { slug: { contains: input.search, mode: "insensitive" } },
              { seoTitle: { contains: input.search, mode: "insensitive" } },
            ],
          }),
    };
    const [items, total] = await this.database.$transaction([
      this.database.contentEntry.findMany({
        where,
        include: entryInclude,
        orderBy: { updatedAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.database.contentEntry.count({ where }),
    ]);
    return {
      items: items.map(toEntry),
      page: input.page,
      pageSize: input.pageSize,
      total,
      pageCount: Math.ceil(total / input.pageSize),
    };
  }

  async getEntry(id: string): Promise<ContentEntryModel | null> {
    const record = await this.database.contentEntry.findUnique({ where: { id }, include: entryInclude });
    return record ? toEntry(record) : null;
  }

  async getPublishedEntry(apiId: string, slug: string, locale: string): Promise<ContentEntryModel | null> {
    const record = await this.database.contentEntry.findFirst({
      where: { contentType: { apiId }, slug, locale, status: "PUBLISHED" },
      include: entryInclude,
    });
    return record ? toEntry(record) : null;
  }

  async listPublishedEntries(apiId: string, locale: string, page: number, pageSize: number): Promise<Page<ContentEntryModel>> {
    const where: Prisma.ContentEntryWhereInput = {
      contentType: { apiId },
      locale,
      status: "PUBLISHED",
    };
    const [items, total] = await this.database.$transaction([
      this.database.contentEntry.findMany({
        where,
        include: entryInclude,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.contentEntry.count({ where }),
    ]);
    return { items: items.map(toEntry), page, pageSize, total, pageCount: Math.ceil(total / pageSize) };
  }

  async createEntry(input: EntryInput, actorId: string | null): Promise<ContentEntryModel> {
    const created = await this.database.$transaction(async (transaction) => {
      const entry = await transaction.contentEntry.create({
        data: {
          contentTypeId: input.contentTypeId,
          slug: input.slug,
          locale: input.locale,
          data: input.data as Prisma.InputJsonValue,
          ...(input.seoTitle === undefined ? {} : { seoTitle: input.seoTitle }),
          ...(input.seoDescription === undefined ? {} : { seoDescription: input.seoDescription }),
          ...(input.seoMetadata === undefined || input.seoMetadata === null
            ? {}
            : { seoMetadata: input.seoMetadata as Prisma.InputJsonValue }),
          createdById: actorId,
          updatedById: actorId,
        },
      });
      if (input.relations && input.relations.length > 0) {
        await transaction.entryRelation.createMany({
          data: input.relations.map((relation) => ({
            sourceEntryId: entry.id,
            targetEntryId: relation.targetEntryId,
            fieldKey: relation.fieldKey,
          })),
          skipDuplicates: true,
        });
      }
      await transaction.contentRevision.create({
        data: snapshotData(entry, actorId),
      });
      return entry.id;
    });
    const result = await this.getEntry(created);
    if (!result) throw new Error("Entry disappeared after creation");
    return result;
  }

  async updateEntry(id: string, input: EntryUpdateInput, actorId: string | null): Promise<ContentEntryModel> {
    await this.database.$transaction(async (transaction) => {
      const existing = await transaction.contentEntry.findUniqueOrThrow({ where: { id } });
      const revision = existing.currentRevision + 1;
      const entry = await transaction.contentEntry.update({
        where: { id },
        data: {
          ...(input.slug === undefined ? {} : { slug: input.slug }),
          ...(input.locale === undefined ? {} : { locale: input.locale }),
          ...(input.data === undefined ? {} : { data: input.data as Prisma.InputJsonValue }),
          ...(input.seoTitle === undefined ? {} : { seoTitle: input.seoTitle }),
          ...(input.seoDescription === undefined ? {} : { seoDescription: input.seoDescription }),
          ...(input.seoMetadata === undefined
            ? {}
            : input.seoMetadata === null
              ? { seoMetadata: Prisma.DbNull }
              : { seoMetadata: input.seoMetadata as Prisma.InputJsonValue }),
          currentRevision: revision,
          updatedById: actorId,
        },
      });
      if (input.relations) {
        await transaction.entryRelation.deleteMany({ where: { sourceEntryId: id } });
        if (input.relations.length > 0) {
          await transaction.entryRelation.createMany({
            data: input.relations.map((relation) => ({
              sourceEntryId: id,
              targetEntryId: relation.targetEntryId,
              fieldKey: relation.fieldKey,
            })),
            skipDuplicates: true,
          });
        }
      }
      await transaction.contentRevision.create({ data: snapshotData(entry, actorId) });
    });
    const result = await this.getEntry(id);
    if (!result) throw new Error("Entry disappeared after update");
    return result;
  }

  async setEntryStatus(
    id: string,
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
    actorId: string | null,
    options: { scheduledPublishAt?: Date | null } = {},
  ): Promise<ContentEntryModel> {
    await this.database.$transaction(async (transaction) => {
      const existing = await transaction.contentEntry.findUniqueOrThrow({ where: { id } });
      const now = new Date();
      const scheduledPublishAt = options.scheduledPublishAt;
      const entry = await transaction.contentEntry.update({
        where: { id },
        data: {
          status,
          currentRevision: existing.currentRevision + 1,
          updatedById: actorId,
          ...(scheduledPublishAt === undefined ? {} : { scheduledPublishAt }),
          ...(status === "PUBLISHED"
            ? { publishedAt: now, archivedAt: null, scheduledPublishAt: null }
            : {}),
          ...(status === "ARCHIVED"
            ? { archivedAt: now, scheduledPublishAt: null }
            : {}),
          ...(status === "DRAFT"
            ? { archivedAt: null, ...(scheduledPublishAt === undefined ? { scheduledPublishAt: null } : {}) }
            : {}),
        },
      });
      await transaction.contentRevision.create({ data: snapshotData(entry, actorId) });
    });
    const result = await this.getEntry(id);
    if (!result) throw new Error("Entry disappeared after status update");
    return result;
  }

  async deleteEntry(id: string): Promise<void> {
    await this.database.contentEntry.delete({ where: { id } });
  }

  async listRevisions(entryId: string): Promise<ContentRevisionModel[]> {
    const records = await this.database.contentRevision.findMany({
      where: { entryId },
      orderBy: { revision: "desc" },
      take: 100,
    });
    return records.map((record) => ({
      id: record.id,
      entryId: record.entryId,
      revision: record.revision,
      slug: record.slug,
      locale: record.locale,
      status: record.status,
      data: toObject(record.data),
      seoTitle: record.seoTitle,
      seoDescription: record.seoDescription,
      seoMetadata: toNullableObject(record.seoMetadata),
      scheduledPublishAt: record.scheduledPublishAt,
      publishedAt: record.publishedAt,
      archivedAt: record.archivedAt,
      createdById: record.createdById,
      createdAt: record.createdAt,
    }));
  }

  async listDueScheduled(now: Date, limit: number): Promise<ContentEntryModel[]> {
    const due = await this.database.contentEntry.findMany({
      where: {
        status: "DRAFT",
        scheduledPublishAt: { not: null, lte: now },
      },
      include: entryInclude,
      orderBy: { scheduledPublishAt: "asc" },
      take: limit,
    });
    return due.map(toEntry);
  }

  async writeAudit(input: {
    actorUserId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.database.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        ...(input.ipAddress === undefined ? {} : { ipAddress: input.ipAddress }),
        ...(input.userAgent === undefined ? {} : { userAgent: input.userAgent }),
        ...(input.metadata === undefined
          ? {}
          : { metadata: input.metadata as Prisma.InputJsonValue }),
      },
    });
  }
}

function toContentType(record: ContentTypeRecord): ContentTypeModel {
  return {
    id: record.id,
    name: record.name,
    apiId: record.apiId,
    description: record.description,
    fields: record.fields.map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      localized: field.localized,
      position: field.position,
      validation: toNullableObject(field.validation),
      settings: toNullableObject(field.settings),
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toEntry(record: EntryRecord): ContentEntryModel {
  return {
    id: record.id,
    contentTypeId: record.contentTypeId,
    contentTypeApiId: record.contentType.apiId,
    slug: record.slug,
    locale: record.locale,
    status: record.status,
    data: toObject(record.data),
    seoTitle: record.seoTitle,
    seoDescription: record.seoDescription,
    seoMetadata: toNullableObject(record.seoMetadata),
    scheduledPublishAt: record.scheduledPublishAt,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    currentRevision: record.currentRevision,
    relations: record.outgoingRelations.map((relation) => ({
      fieldKey: relation.fieldKey,
      targetEntryId: relation.targetEntryId,
    })),
    createdById: record.createdById,
    updatedById: record.updatedById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function snapshotData(
  entry: {
    id: string;
    currentRevision: number;
    slug: string;
    locale: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    data: Prisma.JsonValue;
    seoTitle: string | null;
    seoDescription: string | null;
    seoMetadata: Prisma.JsonValue | null;
    scheduledPublishAt: Date | null;
    publishedAt: Date | null;
    archivedAt: Date | null;
  },
  actorId: string | null,
): Prisma.ContentRevisionUncheckedCreateInput {
  return {
    entryId: entry.id,
    revision: entry.currentRevision,
    slug: entry.slug,
    locale: entry.locale,
    status: entry.status,
    data: entry.data as Prisma.InputJsonValue,
    seoTitle: entry.seoTitle,
    seoDescription: entry.seoDescription,
    ...(entry.seoMetadata === null
      ? {}
      : { seoMetadata: entry.seoMetadata as Prisma.InputJsonValue }),
    scheduledPublishAt: entry.scheduledPublishAt,
    publishedAt: entry.publishedAt,
    archivedAt: entry.archivedAt,
    createdById: actorId,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function toNullableObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value === null ? null : toObject(value);
}
