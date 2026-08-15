import { AppError, type HttpRequestContext, type HttpRouteDefinition } from "@beyondx/core";
import { parseInput } from "@beyondx/validation";
import { z } from "zod";
import type {
  DataFieldCreateInput,
  DataFieldUpdateInput,
  DataRecordCreateInput,
  DataRecordListInput,
  DataRecordUpdateInput,
  DataSchemaCreateInput,
  DataSchemaUpdateInput,
} from "../application/contracts.js";
import type { SchemaService } from "../application/schema-service.js";
import type { DataField, DataRecord, DataSchema, EntityExtension, Page } from "../domain/models.js";

const id = z.string().trim().min(1).max(160);
const schemaKey = z.string().trim().min(2).max(80);
const idParamsSchema = z.object({ id });
const schemaKeyParamsSchema = z.object({ schemaKey });
const recordParamsSchema = z.object({ schemaKey, id });
const slugValue = z.string().trim().min(1).max(180);
const slugParamsSchema = z.object({ slug: slugValue });
const extensionParamsSchema = z.object({ schemaKey, targetType: z.string().trim().min(1).max(80), targetId: id });
const objectValue = z.record(z.unknown());
const nullableObject = objectValue.nullable();

const schemaKind = z.enum(["COLLECTION", "SINGLE", "COMPONENT"]);
const fieldType = z.enum(["TEXT", "LONG_TEXT", "RICH_TEXT", "UID", "NUMBER", "BOOLEAN", "DATE", "JSON", "ENUM", "MEDIA", "RELATION", "COMPONENT", "DYNAMIC_ZONE"]);
const recordStatus = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

const schemaCreateSchema = z.object({
  key: schemaKey,
  displayName: z.string().trim().min(1).max(120),
  pluralName: z.string().trim().min(1).max(120),
  description: z.string().max(1000).nullable().optional(),
  kind: schemaKind.default("COLLECTION"),
  publicRead: z.boolean().default(false),
}).transform((value): DataSchemaCreateInput => ({
  key: value.key,
  displayName: value.displayName,
  pluralName: value.pluralName,
  ...(value.description === undefined ? {} : { description: value.description }),
  kind: value.kind,
  publicRead: value.publicRead,
}));

const schemaUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  pluralName: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  publicRead: z.boolean().optional(),
}).transform((value): DataSchemaUpdateInput => ({
  ...(value.displayName === undefined ? {} : { displayName: value.displayName }),
  ...(value.pluralName === undefined ? {} : { pluralName: value.pluralName }),
  ...(value.description === undefined ? {} : { description: value.description }),
  ...(value.publicRead === undefined ? {} : { publicRead: value.publicRead }),
}));

const fieldCreateSchema = z.object({
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  type: fieldType,
  required: z.boolean().default(false),
  repeatable: z.boolean().default(false),
  position: z.coerce.number().int().min(0).max(100_000).default(0),
  validation: nullableObject.optional(),
  settings: nullableObject.optional(),
  relationTargetSchemaId: id.nullable().optional(),
}).transform((value): DataFieldCreateInput => ({
  key: value.key,
  label: value.label,
  type: value.type,
  required: value.required,
  repeatable: value.repeatable,
  position: value.position,
  ...(value.validation === undefined ? {} : { validation: value.validation }),
  ...(value.settings === undefined ? {} : { settings: value.settings }),
  ...(value.relationTargetSchemaId === undefined ? {} : { relationTargetSchemaId: value.relationTargetSchemaId }),
}));

const fieldUpdateSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  required: z.boolean().optional(),
  repeatable: z.boolean().optional(),
  position: z.coerce.number().int().min(0).max(100_000).optional(),
  validation: nullableObject.optional(),
  settings: nullableObject.optional(),
  relationTargetSchemaId: id.nullable().optional(),
}).transform((value): DataFieldUpdateInput => ({
  ...(value.label === undefined ? {} : { label: value.label }),
  ...(value.required === undefined ? {} : { required: value.required }),
  ...(value.repeatable === undefined ? {} : { repeatable: value.repeatable }),
  ...(value.position === undefined ? {} : { position: value.position }),
  ...(value.validation === undefined ? {} : { validation: value.validation }),
  ...(value.settings === undefined ? {} : { settings: value.settings }),
  ...(value.relationTargetSchemaId === undefined ? {} : { relationTargetSchemaId: value.relationTargetSchemaId }),
}));

const recordListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  status: recordStatus.optional(),
}).transform((value): DataRecordListInput => ({
  page: value.page,
  pageSize: value.pageSize,
  ...(value.status === undefined ? {} : { status: value.status }),
}));

const recordCreateSchema = z.object({
  status: recordStatus.default("DRAFT"),
  values: objectValue.default({}),
}).transform((value): DataRecordCreateInput => ({ status: value.status, values: value.values }));

const recordUpdateSchema = z.object({
  status: recordStatus.optional(),
  values: objectValue.optional(),
}).transform((value): DataRecordUpdateInput => ({
  ...(value.status === undefined ? {} : { status: value.status }),
  ...(value.values === undefined ? {} : { values: value.values }),
}));

const extensionBodySchema = z.object({ values: objectValue.default({}) });

export function createSchemaRoutes(service: SchemaService): HttpRouteDefinition[] {
  return [
    protectedRoute("GET", "/api/v1/admin/schemas", "List schemas available to the data model builder", "schema.builder.read", async () => ({
      body: { items: (await service.listSchemas()).map(publicSchema) },
    }), { response: { 200: schemaListJsonSchema } }),
    protectedRoute("GET", "/api/v1/admin/runtime-schemas", "List schema definitions used by generated content forms", "schema.records.read", async () => ({
      body: {
        items: (await service.listSchemas())
          .filter((schema) => schema.kind !== "SYSTEM_EXTENSION")
          .map(publicSchema),
      },
    }), { response: { 200: schemaListJsonSchema } }),
    protectedRoute("POST", "/api/v1/admin/schemas", "Create a dynamic collection, single type or reusable component", "schema.builder.manage", async (context) => ({
      statusCode: 201,
      body: { schema: publicSchema(await service.createSchema(parseInput(schemaCreateSchema, context.body), actionMetadata(context))) },
    }), { body: schemaCreateJsonSchema, response: { 201: schemaEnvelopeJsonSchema } }),
    protectedRoute("GET", "/api/v1/admin/schemas/:id", "Read a schema and its fields", "schema.builder.read", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { schema: publicSchema(await service.getSchema(params.id)) } };
    }, { params: idParamsJsonSchema, response: { 200: schemaEnvelopeJsonSchema } }),
    protectedRoute("PATCH", "/api/v1/admin/schemas/:id", "Update dynamic schema settings", "schema.builder.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { schema: publicSchema(await service.updateSchema(params.id, parseInput(schemaUpdateSchema, context.body), actionMetadata(context))) } };
    }, { params: idParamsJsonSchema, body: schemaUpdateJsonSchema, response: { 200: schemaEnvelopeJsonSchema } }),
    protectedRoute("DELETE", "/api/v1/admin/schemas/:id", "Delete an unused custom schema", "schema.builder.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      await service.deleteSchema(params.id, actionMetadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),
    protectedRoute("POST", "/api/v1/admin/schemas/:id/fields", "Add a field to a schema", "schema.builder.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { statusCode: 201, body: { schema: publicSchema(await service.createField(params.id, parseInput(fieldCreateSchema, context.body), actionMetadata(context))) } };
    }, { params: idParamsJsonSchema, body: fieldCreateJsonSchema, response: { 201: schemaEnvelopeJsonSchema } }),
    protectedRoute("PATCH", "/api/v1/admin/schema-fields/:id", "Update a schema field", "schema.builder.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { schema: publicSchema(await service.updateField(params.id, parseInput(fieldUpdateSchema, context.body), actionMetadata(context))) } };
    }, { params: idParamsJsonSchema, body: fieldUpdateJsonSchema, response: { 200: schemaEnvelopeJsonSchema } }),
    protectedRoute("DELETE", "/api/v1/admin/schema-fields/:id", "Delete a schema field", "schema.builder.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { schema: publicSchema(await service.deleteField(params.id, actionMetadata(context))) } };
    }, { params: idParamsJsonSchema, response: { 200: schemaEnvelopeJsonSchema } }),

    protectedRoute("GET", "/api/v1/admin/data/:schemaKey", "List records for a dynamic schema", "schema.records.read", async (context) => {
      const params = parseInput(schemaKeyParamsSchema, context.params);
      return { body: publicPage(await service.listRecords(params.schemaKey, parseInput(recordListSchema, context.query ?? {}))) };
    }, { params: schemaKeyParamsJsonSchema, querystring: recordListJsonSchema, response: { 200: recordPageJsonSchema } }),
    protectedRoute("POST", "/api/v1/admin/data/:schemaKey", "Create a record using the schema definition", "schema.records.create", async (context) => {
      const params = parseInput(schemaKeyParamsSchema, context.params);
      const audit = actionMetadata(context);
      return { statusCode: 201, body: { record: publicRecord(await service.createRecord(params.schemaKey, parseInput(recordCreateSchema, context.body), audit.actorUserId, audit)) } };
    }, { params: schemaKeyParamsJsonSchema, body: recordBodyJsonSchema, response: { 201: recordEnvelopeJsonSchema } }),
    protectedRoute("GET", "/api/v1/admin/data/:schemaKey/:id", "Read one dynamic record", "schema.records.read", async (context) => {
      const params = parseInput(recordParamsSchema, context.params);
      return { body: { record: publicRecord(await service.getRecord(params.schemaKey, params.id)) } };
    }, { params: recordParamsJsonSchema, response: { 200: recordEnvelopeJsonSchema } }),
    protectedRoute("PATCH", "/api/v1/admin/data/:schemaKey/:id", "Update a dynamic record", "schema.records.update", async (context) => {
      const params = parseInput(recordParamsSchema, context.params);
      const audit = actionMetadata(context);
      return { body: { record: publicRecord(await service.updateRecord(params.schemaKey, params.id, parseInput(recordUpdateSchema, context.body), audit.actorUserId, audit)) } };
    }, { params: recordParamsJsonSchema, body: recordUpdateJsonSchema, response: { 200: recordEnvelopeJsonSchema } }),
    protectedRoute("DELETE", "/api/v1/admin/data/:schemaKey/:id", "Delete a dynamic record", "schema.records.delete", async (context) => {
      const params = parseInput(recordParamsSchema, context.params);
      await service.deleteRecord(params.schemaKey, params.id, actionMetadata(context));
      return { statusCode: 204, body: null };
    }, { params: recordParamsJsonSchema }),

    protectedRoute("GET", "/api/v1/admin/extensions/:schemaKey/:targetType/:targetId", "Read dynamic fields attached to a system entity", "schema.records.read", async (context) => {
      const params = parseInput(extensionParamsSchema, context.params);
      const extension = await service.getExtension(params.schemaKey, params.targetType, params.targetId);
      return { body: { extension: extension ? publicExtension(extension) : null } };
    }, { params: extensionParamsJsonSchema }),
    protectedRoute("PUT", "/api/v1/admin/extensions/:schemaKey/:targetType/:targetId", "Save dynamic fields attached to a system entity", "schema.records.update", async (context) => {
      const params = parseInput(extensionParamsSchema, context.params);
      const body = parseInput(extensionBodySchema, context.body);
      return { body: { extension: publicExtension(await service.upsertExtension(params.schemaKey, params.targetType, params.targetId, body.values, actionMetadata(context))) } };
    }, { params: extensionParamsJsonSchema, body: extensionJsonSchema }),

    publicContentRoute("GET", "/api/v1/pages", "List active corporate pages", async (context) => {
      const query = parseInput(recordListSchema, { ...(context.query ?? {}), status: "ACTIVE" });
      return { body: publicPage(await service.listRecords("site-page", query, true)) };
    }, { querystring: publicRecordListJsonSchema, response: { 200: recordPageJsonSchema } }),

    publicContentRoute("GET", "/api/v1/pages/:slug", "Read an active corporate page by slug", async (context) => {
      const params = parseInput(slugParamsSchema, context.params);
      return { body: { page: publicRecord(await service.getRecordByStringValue("site-page", "slug", params.slug, true)) } };
    }, { params: slugParamsJsonSchema, response: { 200: pageEnvelopeJsonSchema } }),

    publicContentRoute("GET", "/api/v1/blog/posts", "List active blog posts", async (context) => {
      const query = parseInput(recordListSchema, { ...(context.query ?? {}), status: "ACTIVE" });
      return { body: publicPage(await service.listRecords("blog-post", query, true)) };
    }, { querystring: publicRecordListJsonSchema, response: { 200: recordPageJsonSchema } }),

    publicContentRoute("GET", "/api/v1/blog/posts/:slug", "Read an active blog post by slug", async (context) => {
      const params = parseInput(slugParamsSchema, context.params);
      return { body: { post: publicRecord(await service.getRecordByStringValue("blog-post", "slug", params.slug, true)) } };
    }, { params: slugParamsJsonSchema, response: { 200: postEnvelopeJsonSchema } }),

    publicContentRoute("GET", "/api/v1/blog/categories", "List active blog categories", async (context) => {
      const query = parseInput(recordListSchema, { ...(context.query ?? {}), status: "ACTIVE" });
      return { body: publicPage(await service.listRecords("blog-category", query, true)) };
    }, { querystring: publicRecordListJsonSchema, response: { 200: recordPageJsonSchema } }),

    publicContentRoute("GET", "/api/v1/blog/tags", "List active blog tags", async (context) => {
      const query = parseInput(recordListSchema, { ...(context.query ?? {}), status: "ACTIVE" });
      return { body: publicPage(await service.listRecords("blog-tag", query, true)) };
    }, { querystring: publicRecordListJsonSchema, response: { 200: recordPageJsonSchema } }),

    publicRoute("GET", "/api/v1/site/settings", "Read public site settings", async () => {
      const page = await service.listRecords("site-settings", { page: 1, pageSize: 1, status: "ACTIVE" }, true);
      return { body: { settings: page.items[0] ? publicRecord(page.items[0]) : null } };
    }, { response: { 200: siteSettingsEnvelopeJsonSchema } }),

    publicRoute("GET", "/api/v1/data/:schemaKey", "List active records from a public dynamic collection", async (context) => {
      const params = parseInput(schemaKeyParamsSchema, context.params);
      const query = parseInput(recordListSchema, { ...(context.query ?? {}), status: "ACTIVE" });
      return { body: publicPage(await service.listRecords(params.schemaKey, query, true)) };
    }, { params: schemaKeyParamsJsonSchema, querystring: publicRecordListJsonSchema, response: { 200: recordPageJsonSchema } }),
    publicRoute("GET", "/api/v1/data/:schemaKey/:id", "Read an active record from a public dynamic collection", async (context) => {
      const params = parseInput(recordParamsSchema, context.params);
      return { body: { record: publicRecord(await service.getRecord(params.schemaKey, params.id, true)) } };
    }, { params: recordParamsJsonSchema, response: { 200: recordEnvelopeJsonSchema } }),
  ];
}

function protectedRoute(method: HttpRouteDefinition["method"], path: string, summary: string, permission: string, handler: HttpRouteDefinition["handler"], schema?: Record<string, unknown>): HttpRouteDefinition {
  return { method, path, summary, tags: ["Schema Builder"], public: false, permission, ...(schema === undefined ? {} : { schema }), handler };
}
function publicRoute(method: HttpRouteDefinition["method"], path: string, summary: string, handler: HttpRouteDefinition["handler"], schema?: Record<string, unknown>): HttpRouteDefinition {
  return { method, path, summary, tags: ["Dynamic Data"], public: true, ...(schema === undefined ? {} : { schema }), handler };
}
function publicContentRoute(method: HttpRouteDefinition["method"], path: string, summary: string, handler: HttpRouteDefinition["handler"], schema?: Record<string, unknown>): HttpRouteDefinition {
  return { method, path, summary, tags: ["Corporate CMS"], public: true, ...(schema === undefined ? {} : { schema }), handler };
}

function actionMetadata(context: HttpRequestContext) {
  if (!context.principal) throw new AppError({ code: "IDENTITY_AUTHENTICATION_REQUIRED", message: "Authentication is required", statusCode: 401 });
  const userAgent = readHeader(context, "user-agent");
  return {
    actorUserId: context.principal.subject,
    requestId: context.requestId,
    ipAddress: context.ip,
    ...(userAgent === undefined ? {} : { userAgent }),
  };
}
function readHeader(context: HttpRequestContext, name: string): string | undefined {
  const value = context.headers[name];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

function publicSchema(schema: DataSchema) {
  return { ...schema, fields: schema.fields.map(publicField) };
}
function publicField(field: DataField) { return field; }
function publicRecord(record: DataRecord) { return record; }
function publicExtension(extension: EntityExtension) { return extension; }
function publicPage(page: Page<DataRecord>) { return { ...page, items: page.items.map(publicRecord) }; }

const idParamsJsonSchema = { type: "object", required: ["id"], properties: { id: { type: "string" } } };
const schemaKeyParamsJsonSchema = { type: "object", required: ["schemaKey"], properties: { schemaKey: { type: "string" } } };
const recordParamsJsonSchema = { type: "object", required: ["schemaKey", "id"], properties: { schemaKey: { type: "string" }, id: { type: "string" } } };
const slugParamsJsonSchema = { type: "object", required: ["slug"], properties: { slug: { type: "string", minLength: 1, maxLength: 180 } } };
const extensionParamsJsonSchema = { type: "object", required: ["schemaKey", "targetType", "targetId"], properties: { schemaKey: { type: "string" }, targetType: { type: "string" }, targetId: { type: "string" } } };
const fieldJsonSchema = { type: "object", additionalProperties: true, required: ["id", "schemaId", "key", "label", "type", "required", "repeatable", "position", "createdAt", "updatedAt"], properties: { id: { type: "string" }, schemaId: { type: "string" }, key: { type: "string" }, label: { type: "string" }, type: { type: "string" }, required: { type: "boolean" }, repeatable: { type: "boolean" }, position: { type: "integer" }, validation: { type: ["object", "null"] }, settings: { type: ["object", "null"] }, relationTargetSchemaId: { type: ["string", "null"] }, createdAt: { type: "string" }, updatedAt: { type: "string" } } };
const schemaJsonSchema = { type: "object", additionalProperties: true, required: ["id", "key", "displayName", "pluralName", "kind", "publicRead", "system", "fields", "createdAt", "updatedAt"], properties: { id: { type: "string" }, key: { type: "string" }, displayName: { type: "string" }, pluralName: { type: "string" }, description: { type: ["string", "null"] }, kind: { type: "string" }, publicRead: { type: "boolean" }, system: { type: "boolean" }, fields: { type: "array", items: fieldJsonSchema }, createdAt: { type: "string" }, updatedAt: { type: "string" } } };
const schemaListJsonSchema = { type: "object", required: ["items"], properties: { items: { type: "array", items: schemaJsonSchema } } };
const schemaEnvelopeJsonSchema = { type: "object", required: ["schema"], properties: { schema: schemaJsonSchema } };
const schemaCreateJsonSchema = { type: "object", required: ["key", "displayName", "pluralName"], properties: { key: { type: "string" }, displayName: { type: "string" }, pluralName: { type: "string" }, description: { type: ["string", "null"] }, kind: { type: "string", enum: ["COLLECTION", "SINGLE", "COMPONENT"] }, publicRead: { type: "boolean" } } };
const schemaUpdateJsonSchema = { type: "object", properties: { displayName: { type: "string" }, pluralName: { type: "string" }, description: { type: ["string", "null"] }, publicRead: { type: "boolean" } } };
const fieldCreateJsonSchema = { type: "object", required: ["key", "label", "type"], properties: { key: { type: "string" }, label: { type: "string" }, type: { type: "string", enum: ["TEXT", "LONG_TEXT", "RICH_TEXT", "UID", "NUMBER", "BOOLEAN", "DATE", "JSON", "ENUM", "MEDIA", "RELATION", "COMPONENT", "DYNAMIC_ZONE"] }, required: { type: "boolean" }, repeatable: { type: "boolean" }, position: { type: "integer" }, validation: { type: ["object", "null"] }, settings: { type: ["object", "null"] }, relationTargetSchemaId: { type: ["string", "null"] } } };
const fieldUpdateJsonSchema = { type: "object", properties: { label: { type: "string" }, required: { type: "boolean" }, repeatable: { type: "boolean" }, position: { type: "integer" }, validation: { type: ["object", "null"] }, settings: { type: ["object", "null"] }, relationTargetSchemaId: { type: ["string", "null"] } } };
const recordJsonSchema = { type: "object", additionalProperties: true, required: ["id", "schemaId", "schemaKey", "status", "values", "createdAt", "updatedAt"], properties: { id: { type: "string" }, schemaId: { type: "string" }, schemaKey: { type: "string" }, status: { type: "string" }, values: { type: "object", additionalProperties: true }, createdById: { type: ["string", "null"] }, updatedById: { type: ["string", "null"] }, createdAt: { type: "string" }, updatedAt: { type: "string" } } };
const recordEnvelopeJsonSchema = { type: "object", required: ["record"], properties: { record: recordJsonSchema } };
const pageEnvelopeJsonSchema = { type: "object", required: ["page"], properties: { page: recordJsonSchema } };
const postEnvelopeJsonSchema = { type: "object", required: ["post"], properties: { post: recordJsonSchema } };
const siteSettingsEnvelopeJsonSchema = { type: "object", required: ["settings"], properties: { settings: { anyOf: [recordJsonSchema, { type: "null" }] } } };
const recordPageJsonSchema = { type: "object", required: ["items", "page", "pageSize", "total", "pageCount"], properties: { items: { type: "array", items: recordJsonSchema }, page: { type: "integer" }, pageSize: { type: "integer" }, total: { type: "integer" }, pageCount: { type: "integer" } } };
const recordListJsonSchema = { type: "object", properties: { page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 }, status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] } } };
const publicRecordListJsonSchema = { type: "object", properties: { page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 } } };
const recordBodyJsonSchema = { type: "object", properties: { status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }, values: { type: "object", additionalProperties: true } } };
const recordUpdateJsonSchema = recordBodyJsonSchema;
const extensionJsonSchema = { type: "object", required: ["values"], properties: { values: { type: "object", additionalProperties: true } } };
