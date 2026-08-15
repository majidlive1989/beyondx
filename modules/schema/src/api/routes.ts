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

const contactFormSubmissionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(60).optional(),
  subject: z.string().trim().max(180).optional(),
  message: z.string().trim().min(2).max(5000),
  locale: z.string().trim().max(20).optional(),
  pageUrl: z.string().trim().max(2048).optional(),
  website: z.string().trim().max(200).optional(),
});

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

    publicContentRoute("GET", "/api/v1/navigation", "Read resolved public header and footer navigation", async () => {
      const page = await service.listRecords("site-navigation", { page: 1, pageSize: 1, status: "ACTIVE" }, true);
      const record = page.items[0] ?? null;
      return { body: { navigation: record ? await resolveNavigation(service, record) : { header: [], footer: [] } } };
    }, { response: { 200: navigationEnvelopeJsonSchema } }),

    publicFormRoute("POST", "/api/v1/forms/contact", "Submit the public contact form", async (context) => {
      const body = parseInput(contactFormSubmissionSchema, context.body);

      // Honeypot: bots can submit successfully without creating an inbox record.
      if (body.website) return { statusCode: 202, body: { submitted: true } };

      const values: Record<string, unknown> = {
        name: body.name,
        email: body.email,
        message: body.message,
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.subject ? { subject: body.subject } : {}),
        ...(body.locale ? { locale: body.locale } : {}),
        ...(body.pageUrl ? { pageUrl: body.pageUrl } : {}),
      };

      await service.createRecord(
        "contact-submission",
        { status: "DRAFT", values },
        null,
        publicActionMetadata(context),
      );
      return { statusCode: 201, body: { submitted: true } };
    }, {
      body: contactFormSubmissionJsonSchema,
      response: { 201: formSubmissionResultJsonSchema, 202: formSubmissionResultJsonSchema },
    }),

    publicRoute("GET", "/api/v1/site/settings", "Read public site settings", async () => {
      const page = await service.listRecords("site-settings", { page: 1, pageSize: 1, status: "ACTIVE" }, true);
      return { body: { settings: page.items[0] ? publicRecord(page.items[0]) : null } };
    }, { response: { 200: siteSettingsEnvelopeJsonSchema } }),

    publicSeoRoute("GET", "/api/v1/seo/config", "Read public SEO defaults", async () => {
      const page = await service.listRecords("site-settings", { page: 1, pageSize: 1, status: "ACTIVE" }, true);
      return { body: { seo: buildSeoConfig(page.items[0] ?? null) } };
    }, { response: { 200: seoConfigEnvelopeJsonSchema } }),

    publicSeoRoute("GET", "/api/v1/seo/sitemap", "List public sitemap entries", async () => {
      const settingsPage = await service.listRecords("site-settings", { page: 1, pageSize: 1, status: "ACTIVE" }, true);
      const seo = buildSeoConfig(settingsPage.items[0] ?? null);
      if (!seo.indexingAllowed) return { body: { entries: [] } };

      const [pages, posts] = await Promise.all([
        listAllActivePublicRecords(service, "site-page"),
        listAllActivePublicRecords(service, "blog-post"),
      ]);
      return { body: { entries: buildSitemapEntries(pages, posts, seo.defaultLocale) } };
    }, { response: { 200: seoSitemapJsonSchema } }),

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
function publicFormRoute(method: HttpRouteDefinition["method"], path: string, summary: string, handler: HttpRouteDefinition["handler"], schema?: Record<string, unknown>): HttpRouteDefinition {
  return { method, path, summary, tags: ["Forms"], public: true, ...(schema === undefined ? {} : { schema }), handler };
}

function publicSeoRoute(method: HttpRouteDefinition["method"], path: string, summary: string, handler: HttpRouteDefinition["handler"], schema?: Record<string, unknown>): HttpRouteDefinition {
  return { method, path, summary, tags: ["SEO"], public: true, ...(schema === undefined ? {} : { schema }), handler };
}


interface PublicNavigationItem {
  label: string;
  href: string;
  style: "LINK" | "BUTTON";
  openInNewTab: boolean;
}

interface PublicNavigation {
  header: PublicNavigationItem[];
  footer: PublicNavigationItem[];
}

async function resolveNavigation(service: SchemaService, record: DataRecord): Promise<PublicNavigation> {
  return {
    header: await resolveNavigationItems(service, record.values.headerItems),
    footer: await resolveNavigationItems(service, record.values.footerItems),
  };
}

async function resolveNavigationItems(service: SchemaService, value: unknown): Promise<PublicNavigationItem[]> {
  if (!Array.isArray(value)) return [];
  const resolved = await Promise.all(value.map(async (entry): Promise<PublicNavigationItem | null> => {
    const item = objectRecord(entry);
    if (!item || item.enabled === false) return null;

    const label = stringRecordValue(item.label);
    if (!label) return null;

    const type = item.type === "PAGE" || item.type === "BLOG" || item.type === "CUSTOM"
      ? item.type
      : "CUSTOM";

    let href = "";
    if (type === "BLOG") {
      href = "/blog";
    } else if (type === "CUSTOM") {
      href = stringRecordValue(item.url);
    } else {
      const pageId = stringRecordValue(item.pageId);
      if (!pageId) return null;
      const linkedPage = await service.getRecord("site-page", pageId, true).catch(() => null);
      const slug = linkedPage ? stringRecordValue(linkedPage.values.slug) : "";
      if (!slug) return null;
      href = slug === "home" ? "/" : `/${slug.replace(/^\/+/, "")}`;
    }

    if (!href) return null;
    return {
      label,
      href,
      style: item.style === "BUTTON" ? "BUTTON" : "LINK",
      openInNewTab: item.openInNewTab === true,
    };
  }));

  return resolved.filter((item): item is PublicNavigationItem => item !== null);
}

interface PublicSeoConfig {
  siteUrl: string | null;
  siteName: string | null;
  defaultTitle: string | null;
  defaultDescription: string | null;
  defaultImageId: string | null;
  defaultLocale: string;
  indexingAllowed: boolean;
}

interface PublicSeoSitemapEntry {
  path: string;
  kind: "PAGE" | "BLOG_POST";
  slug: string;
  locale: string;
  lastModified: string;
}

function buildSeoConfig(settings: DataRecord | null): PublicSeoConfig {
  const values = settings?.values ?? {};
  const siteName = nullableStringRecordValue(values.siteName);
  return {
    siteUrl: normalizeSiteUrl(values.siteUrl),
    siteName,
    defaultTitle: nullableStringRecordValue(values.seoTitle) ?? siteName,
    defaultDescription: nullableStringRecordValue(values.seoDescription) ?? nullableStringRecordValue(values.description),
    defaultImageId: nullableStringRecordValue(values.seoImage),
    defaultLocale: nullableStringRecordValue(values.defaultLocale) ?? "en",
    indexingAllowed: settings !== null && values.allowSearchIndexing !== false,
  };
}

async function listAllActivePublicRecords(service: SchemaService, schemaKey: string): Promise<DataRecord[]> {
  const items: DataRecord[] = [];
  let pageNumber = 1;
  while (true) {
    const page = await service.listRecords(schemaKey, { page: pageNumber, pageSize: 100, status: "ACTIVE" }, true);
    items.push(...page.items);
    if (pageNumber >= page.pageCount) return items;
    pageNumber += 1;
  }
}

function buildSitemapEntries(pages: DataRecord[], posts: DataRecord[], defaultLocale: string): PublicSeoSitemapEntry[] {
  const entries: PublicSeoSitemapEntry[] = [];
  for (const page of pages) {
    if (page.values.noIndex === true) continue;
    const slug = stringRecordValue(page.values.slug);
    if (!slug) continue;
    entries.push({
      path: slug === "home" ? "/" : `/${slug.replace(/^\/+/, "")}`,
      kind: "PAGE",
      slug,
      locale: nullableStringRecordValue(page.values.locale) ?? defaultLocale,
      lastModified: isoRecordDate(page.updatedAt),
    });
  }
  for (const post of posts) {
    if (post.values.noIndex === true) continue;
    const slug = stringRecordValue(post.values.slug);
    if (!slug) continue;
    entries.push({
      path: `/blog/${slug.replace(/^\/+/, "")}`,
      kind: "BLOG_POST",
      slug,
      locale: nullableStringRecordValue(post.values.locale) ?? defaultLocale,
      lastModified: isoRecordDate(post.updatedAt),
    });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeSiteUrl(value: unknown): string | null {
  const raw = nullableStringRecordValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return raw.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function nullableStringRecordValue(value: unknown): string | null {
  const result = stringRecordValue(value);
  return result || null;
}

function isoRecordDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = typeof value === "string" ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date(0).toISOString();
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringRecordValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function publicActionMetadata(context: HttpRequestContext) {
  const userAgent = readHeader(context, "user-agent");
  return {
    actorUserId: null,
    requestId: context.requestId,
    ipAddress: context.ip,
    ...(userAgent === undefined ? {} : { userAgent }),
  };
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
const navigationItemJsonSchema = { type: "object", required: ["label", "href", "style", "openInNewTab"], properties: { label: { type: "string" }, href: { type: "string" }, style: { type: "string", enum: ["LINK", "BUTTON"] }, openInNewTab: { type: "boolean" } } };
const navigationPayloadJsonSchema = { type: "object", required: ["header", "footer"], properties: { header: { type: "array", items: navigationItemJsonSchema }, footer: { type: "array", items: navigationItemJsonSchema } } };
const navigationEnvelopeJsonSchema = { type: "object", required: ["navigation"], properties: { navigation: navigationPayloadJsonSchema } };
const seoConfigJsonSchema = {
  type: "object",
  required: ["siteUrl", "siteName", "defaultTitle", "defaultDescription", "defaultImageId", "defaultLocale", "indexingAllowed"],
  properties: {
    siteUrl: { type: ["string", "null"] },
    siteName: { type: ["string", "null"] },
    defaultTitle: { type: ["string", "null"] },
    defaultDescription: { type: ["string", "null"] },
    defaultImageId: { type: ["string", "null"] },
    defaultLocale: { type: "string" },
    indexingAllowed: { type: "boolean" },
  },
};
const seoConfigEnvelopeJsonSchema = { type: "object", required: ["seo"], properties: { seo: seoConfigJsonSchema } };
const seoSitemapEntryJsonSchema = {
  type: "object",
  required: ["path", "kind", "slug", "locale", "lastModified"],
  properties: {
    path: { type: "string" },
    kind: { type: "string", enum: ["PAGE", "BLOG_POST"] },
    slug: { type: "string" },
    locale: { type: "string" },
    lastModified: { type: "string" },
  },
};
const seoSitemapJsonSchema = { type: "object", required: ["entries"], properties: { entries: { type: "array", items: seoSitemapEntryJsonSchema } } };
const contactFormSubmissionJsonSchema = {
  type: "object",
  required: ["name", "email", "message"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    email: { type: "string", minLength: 3, maxLength: 320, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
    phone: { type: "string", maxLength: 60 },
    subject: { type: "string", maxLength: 180 },
    message: { type: "string", minLength: 2, maxLength: 5000 },
    locale: { type: "string", maxLength: 20 },
    pageUrl: { type: "string", maxLength: 2048 },
    website: { type: "string", maxLength: 200 },
  },
};
const formSubmissionResultJsonSchema = {
  type: "object",
  required: ["submitted"],
  properties: { submitted: { type: "boolean", const: true } },
};
const recordPageJsonSchema = { type: "object", required: ["items", "page", "pageSize", "total", "pageCount"], properties: { items: { type: "array", items: recordJsonSchema }, page: { type: "integer" }, pageSize: { type: "integer" }, total: { type: "integer" }, pageCount: { type: "integer" } } };
const recordListJsonSchema = { type: "object", properties: { page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 }, status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] } } };
const publicRecordListJsonSchema = { type: "object", properties: { page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 } } };
const recordBodyJsonSchema = { type: "object", properties: { status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }, values: { type: "object", additionalProperties: true } } };
const recordUpdateJsonSchema = recordBodyJsonSchema;
const extensionJsonSchema = { type: "object", required: ["values"], properties: { values: { type: "object", additionalProperties: true } } };
