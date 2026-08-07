import { AppError, type HttpRequestContext, type HttpRouteDefinition } from "@beyondx/core";
import { parseInput } from "@beyondx/validation";
import { z } from "zod";
import type { ContentActionMetadata, ContentService } from "../application/content-service.js";
import type { ContentTypeInput, ContentTypeUpdateInput, EntryInput, EntryListInput, EntryUpdateInput } from "../application/contracts.js";
import type { ContentEntryModel, ContentTypeModel } from "../domain/models.js";

const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/).max(80),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["TEXT", "RICH_TEXT", "NUMBER", "BOOLEAN", "DATE", "JSON", "RELATION"]),
  required: z.boolean().default(false),
  localized: z.boolean().default(false),
  position: z.coerce.number().int().min(0).max(1000).default(0),
  validation: z.record(z.unknown()).nullable().default(null),
  settings: z.record(z.unknown()).nullable().default(null),
});

const contentTypeCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    apiId: z.string().regex(/^[a-z][a-z0-9-]{1,79}$/),
    description: z.string().trim().max(500).nullable().optional(),
    fields: z.array(fieldSchema).max(100).default([]),
  })
  .transform((value): ContentTypeInput => ({
    name: value.name,
    apiId: value.apiId,
    fields: value.fields,
    ...(value.description === undefined ? {} : { description: value.description }),
  }));

const contentTypeUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    fields: z.array(fieldSchema).max(100).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required",
  })
  .transform((value): ContentTypeUpdateInput => ({
    ...(value.name === undefined ? {} : { name: value.name }),
    ...(value.description === undefined ? {} : { description: value.description }),
    ...(value.fields === undefined ? {} : { fields: value.fields }),
  }));

const relationSchema = z.object({
  fieldKey: z.string().min(1).max(80),
  targetEntryId: z.string().min(1).max(120),
});

const entryCreateSchema = z
  .object({
    contentTypeId: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
    locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).default("en"),
    data: z.record(z.unknown()).default({}),
    seoTitle: z.string().trim().max(120).nullable().optional(),
    seoDescription: z.string().trim().max(320).nullable().optional(),
    seoMetadata: z.record(z.unknown()).nullable().optional(),
    relations: z.array(relationSchema).max(200).optional(),
  })
  .transform((value): EntryInput => ({
    contentTypeId: value.contentTypeId,
    slug: value.slug,
    locale: value.locale,
    data: value.data,
    ...(value.seoTitle === undefined ? {} : { seoTitle: value.seoTitle }),
    ...(value.seoDescription === undefined ? {} : { seoDescription: value.seoDescription }),
    ...(value.seoMetadata === undefined ? {} : { seoMetadata: value.seoMetadata }),
    ...(value.relations === undefined ? {} : { relations: value.relations }),
  }));

const entryUpdateSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180).optional(),
    locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).optional(),
    data: z.record(z.unknown()).optional(),
    seoTitle: z.string().trim().max(120).nullable().optional(),
    seoDescription: z.string().trim().max(320).nullable().optional(),
    seoMetadata: z.record(z.unknown()).nullable().optional(),
    relations: z.array(relationSchema).max(200).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required",
  })
  .transform((value): EntryUpdateInput => ({
    ...(value.slug === undefined ? {} : { slug: value.slug }),
    ...(value.locale === undefined ? {} : { locale: value.locale }),
    ...(value.data === undefined ? {} : { data: value.data }),
    ...(value.seoTitle === undefined ? {} : { seoTitle: value.seoTitle }),
    ...(value.seoDescription === undefined ? {} : { seoDescription: value.seoDescription }),
    ...(value.seoMetadata === undefined ? {} : { seoMetadata: value.seoMetadata }),
    ...(value.relations === undefined ? {} : { relations: value.relations }),
  }));

const entryListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    contentTypeId: z.string().min(1).optional(),
    locale: z.string().max(20).optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
    search: z.string().trim().max(120).optional(),
  })
  .transform((value): EntryListInput => ({
    page: value.page,
    pageSize: value.pageSize,
    ...(value.contentTypeId === undefined ? {} : { contentTypeId: value.contentTypeId }),
    ...(value.locale === undefined ? {} : { locale: value.locale }),
    ...(value.status === undefined ? {} : { status: value.status }),
    ...(value.search === undefined ? {} : { search: value.search }),
  }));

const idParamsSchema = z.object({ id: z.string().min(1) });
const publicParamsSchema = z.object({ apiId: z.string().min(1), slug: z.string().min(1) });
const publicListParamsSchema = z.object({ apiId: z.string().min(1) });
const publicQuerySchema = z.object({
  locale: z.string().max(20).default("en"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const localeQuerySchema = z.object({ locale: z.string().max(20).default("en") });
const scheduleSchema = z.object({ scheduledPublishAt: z.string().datetime().nullable() });

export function createContentRoutes(service: ContentService): HttpRouteDefinition[] {
  return [
    protectedRoute("GET", "/api/v1/admin/content-types", "List content types", "content.types.read", async () => ({
      body: { items: (await service.listContentTypes()).map(serializeContentType) },
    })),
    protectedRoute("POST", "/api/v1/admin/content-types", "Create content type", "content.types.create", async (context) => ({
      statusCode: 201,
      body: { contentType: serializeContentType(await service.createContentType(parseInput(contentTypeCreateSchema, context.body), metadata(context))) },
    }), { body: contentTypeJsonSchema }),
    protectedRoute("GET", "/api/v1/admin/content-types/:id", "Get content type", "content.types.read", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return { body: { contentType: serializeContentType(await service.getContentType(id)) } };
    }, { params: idParamsJsonSchema }),
    protectedRoute("PATCH", "/api/v1/admin/content-types/:id", "Update content type", "content.types.update", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return { body: { contentType: serializeContentType(await service.updateContentType(id, parseInput(contentTypeUpdateSchema, context.body), metadata(context))) } };
    }, { params: idParamsJsonSchema, body: contentTypeUpdateJsonSchema }),
    protectedRoute("DELETE", "/api/v1/admin/content-types/:id", "Delete content type", "content.types.delete", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      await service.deleteContentType(id, metadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),

    protectedRoute("GET", "/api/v1/admin/content-entries", "List content entries", "content.entries.read", async (context) => ({
      body: serializePage(await service.listEntries(parseInput(entryListSchema, context.query))),
    }), { querystring: entryListJsonSchema }),
    protectedRoute("POST", "/api/v1/admin/content-entries", "Create content entry", "content.entries.create", async (context) => ({
      statusCode: 201,
      body: { entry: serializeEntry(await service.createEntry(parseInput(entryCreateSchema, context.body), metadata(context))) },
    }), { body: entryJsonSchema }),
    protectedRoute("GET", "/api/v1/admin/content-entries/:id", "Get content entry", "content.entries.read", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return { body: { entry: serializeEntry(await service.getEntry(id)) } };
    }, { params: idParamsJsonSchema }),
    protectedRoute("PATCH", "/api/v1/admin/content-entries/:id", "Update content entry", "content.entries.update", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return { body: { entry: serializeEntry(await service.updateEntry(id, parseInput(entryUpdateSchema, context.body), metadata(context))) } };
    }, { params: idParamsJsonSchema, body: entryUpdateJsonSchema }),
    protectedRoute("DELETE", "/api/v1/admin/content-entries/:id", "Delete content entry", "content.entries.delete", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      await service.deleteEntry(id, metadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),
    protectedRoute("POST", "/api/v1/admin/content-entries/:id/publish", "Publish content entry", "content.entries.publish", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return { body: { entry: serializeEntry(await service.publishEntry(id, metadata(context))) } };
    }, { params: idParamsJsonSchema }),
    protectedRoute("POST", "/api/v1/admin/content-entries/:id/unpublish", "Unpublish content entry", "content.entries.publish", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return { body: { entry: serializeEntry(await service.unpublishEntry(id, metadata(context))) } };
    }, { params: idParamsJsonSchema }),
    protectedRoute("POST", "/api/v1/admin/content-entries/:id/archive", "Archive content entry", "content.entries.archive", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return { body: { entry: serializeEntry(await service.archiveEntry(id, metadata(context))) } };
    }, { params: idParamsJsonSchema }),
    protectedRoute("POST", "/api/v1/admin/content-entries/:id/schedule", "Schedule content publication", "content.entries.publish", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      const { scheduledPublishAt } = parseInput(scheduleSchema, context.body);
      return {
        body: {
          entry: serializeEntry(await service.scheduleEntry(id, scheduledPublishAt ? new Date(scheduledPublishAt) : null, metadata(context))),
        },
      };
    }, { params: idParamsJsonSchema, body: scheduleJsonSchema }),
    protectedRoute("GET", "/api/v1/admin/content-entries/:id/revisions", "List content revisions", "content.revisions.read", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return { body: { items: (await service.listRevisions(id)).map((revision) => ({
        ...revision,
        scheduledPublishAt: revision.scheduledPublishAt?.toISOString() ?? null,
        publishedAt: revision.publishedAt?.toISOString() ?? null,
        archivedAt: revision.archivedAt?.toISOString() ?? null,
        createdAt: revision.createdAt.toISOString(),
      })) } };
    }, { params: idParamsJsonSchema }),

    publicRoute("GET", "/api/v1/content/:apiId", "List published content", async (context) => {
      const { apiId } = parseInput(publicListParamsSchema, context.params);
      const query = parseInput(publicQuerySchema, context.query);
      return { body: serializePage(await service.listPublishedEntries(apiId, query.locale, query.page, query.pageSize)) };
    }, { params: publicListParamsJsonSchema, querystring: publicQueryJsonSchema }),
    publicRoute("GET", "/api/v1/content/:apiId/:slug", "Get published content entry", async (context) => {
      const { apiId, slug } = parseInput(publicParamsSchema, context.params);
      const { locale } = parseInput(localeQuerySchema, context.query);
      return { body: { entry: serializeEntry(await service.getPublishedEntry(apiId, slug, locale)) } };
    }, { params: publicParamsJsonSchema, querystring: localeQueryJsonSchema }),
  ];
}

type Handler = HttpRouteDefinition["handler"];

function publicRoute(method: HttpRouteDefinition["method"], path: string, summary: string, handler: Handler, schema?: Record<string, unknown>): HttpRouteDefinition {
  return { method, path, summary, tags: ["Content"], public: true, handler, ...(schema ? { schema } : {}) };
}

function protectedRoute(method: HttpRouteDefinition["method"], path: string, summary: string, permission: string, handler: Handler, schema?: Record<string, unknown>): HttpRouteDefinition {
  return { method, path, summary, tags: ["Content Admin"], public: false, permission, handler, ...(schema ? { schema } : {}) };
}

function metadata(context: HttpRequestContext): ContentActionMetadata {
  const userAgent = header(context, "user-agent");
  return {
    actorId: principalId(context),
    requestId: context.requestId,
    ipAddress: context.ip,
    ...(userAgent === null ? {} : { userAgent }),
  };
}

function principalId(context: HttpRequestContext): string {
  if (!context.principal) {
    throw new AppError({ code: "IDENTITY_AUTHENTICATION_REQUIRED", message: "Authentication is required", statusCode: 401 });
  }
  return context.principal.subject;
}

function header(context: HttpRequestContext, name: string): string | null {
  const value = context.headers[name];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function serializeContentType(contentType: ContentTypeModel) {
  return { ...contentType, createdAt: contentType.createdAt.toISOString(), updatedAt: contentType.updatedAt.toISOString() };
}

function serializeEntry(entry: ContentEntryModel) {
  return {
    ...entry,
    scheduledPublishAt: entry.scheduledPublishAt?.toISOString() ?? null,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    archivedAt: entry.archivedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function serializePage(page: { items: ContentEntryModel[]; page: number; pageSize: number; total: number; pageCount: number }) {
  return { ...page, items: page.items.map(serializeEntry) };
}

const idParamsJsonSchema = { type: "object", required: ["id"], properties: { id: { type: "string" } } };
const fieldJsonSchema = {
  type: "object",
  required: ["key", "label", "type"],
  properties: {
    key: { type: "string" }, label: { type: "string" }, type: { type: "string", enum: ["TEXT", "RICH_TEXT", "NUMBER", "BOOLEAN", "DATE", "JSON", "RELATION"] },
    required: { type: "boolean" }, localized: { type: "boolean" }, position: { type: "integer" }, validation: { type: ["object", "null"] }, settings: { type: ["object", "null"] },
  },
};
const contentTypeJsonSchema = { type: "object", required: ["name", "apiId", "fields"], properties: { name: { type: "string" }, apiId: { type: "string" }, description: { type: ["string", "null"] }, fields: { type: "array", items: fieldJsonSchema } } };
const contentTypeUpdateJsonSchema = { ...contentTypeJsonSchema, required: [] };
const relationJsonSchema = { type: "object", required: ["fieldKey", "targetEntryId"], properties: { fieldKey: { type: "string" }, targetEntryId: { type: "string" } } };
const entryJsonSchema = { type: "object", required: ["contentTypeId", "slug", "data"], properties: { contentTypeId: { type: "string" }, slug: { type: "string" }, locale: { type: "string" }, data: { type: "object", additionalProperties: true }, seoTitle: { type: ["string", "null"] }, seoDescription: { type: ["string", "null"] }, seoMetadata: { type: ["object", "null"] }, relations: { type: "array", items: relationJsonSchema } } };
const entryUpdateJsonSchema = { type: "object", properties: { slug: { type: "string" }, locale: { type: "string" }, data: { type: "object", additionalProperties: true }, seoTitle: { type: ["string", "null"] }, seoDescription: { type: ["string", "null"] }, seoMetadata: { type: ["object", "null"] }, relations: { type: "array", items: relationJsonSchema } } };
const entryListJsonSchema = { type: "object", properties: { page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 }, contentTypeId: { type: "string" }, locale: { type: "string" }, status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] }, search: { type: "string" } } };
const scheduleJsonSchema = { type: "object", required: ["scheduledPublishAt"], properties: { scheduledPublishAt: { type: ["string", "null"], format: "date-time" } } };
const publicListParamsJsonSchema = { type: "object", required: ["apiId"], properties: { apiId: { type: "string" } } };
const publicParamsJsonSchema = { type: "object", required: ["apiId", "slug"], properties: { apiId: { type: "string" }, slug: { type: "string" } } };
const publicQueryJsonSchema = { type: "object", properties: { locale: { type: "string" }, page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 } } };
const localeQueryJsonSchema = { type: "object", properties: { locale: { type: "string" } } };
